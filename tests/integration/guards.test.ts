import { describe, expect, it } from "vitest";
import type { Finding, GuardFlags, PipelinePlan, StepResult } from "../../src/core/index.js";
import { collectGuards, validateDag, validatePlan } from "../../src/core/index.js";
import { adapterFor, plannerAdapters } from "../../src/planners/index.js";
import { executePlan } from "../../src/runner/index.js";
import type { ProcessRunner, VerifyFn } from "../../src/runner/index.js";

interface GateResult {
  readonly findings: readonly Finding[];
  readonly results: readonly StepResult[];
  readonly calls: readonly string[][];
}

/**
 * Test gate. It composes the real schema, DAG, guards, and adapters.
 * It calls the real runner only when no finding is an error.
 */
async function runThroughGate(input: unknown, flags: GuardFlags = {}): Promise<GateResult> {
  const calls: string[][] = [];
  const run: ProcessRunner = (argv) => {
    calls.push([...argv]);
    return { exitCode: 0, stdout: "", stderr: "" };
  };
  const verify: VerifyFn = (result) => result;

  const schema = validatePlan(input);
  if (schema.plan === undefined) {
    return { findings: schema.findings, results: [], calls };
  }

  const plan = schema.plan;
  const findings: Finding[] = [...schema.findings];
  findings.push(...validateDag(plan.steps).findings);
  findings.push(...collectGuards(plan, flags));

  const vars = plan.vars ?? {};
  for (const step of plan.steps) {
    findings.push(...adapterFor(step.tool).planFromStep(step, vars).findings);
  }

  if (findings.some((finding) => finding.severity === "error")) {
    return { findings, results: [], calls };
  }

  const results = await executePlan(plan, plannerAdapters, {
    dryRun: false,
    unsafe: flags.unsafe,
    run,
    verify,
  });
  return { findings, results, calls };
}

const unboundPlan: PipelinePlan = {
  version: 1,
  id: "unbound",
  name: "Unbound",
  shell: "posix",
  steps: [
    {
      id: "download",
      tool: "yt-dlp",
      args: [
        { kind: "option", name: "-o", value: "{{outDir}}/source.%(ext)s" },
        { kind: "value", name: "{{sourceUrl}}" },
      ],
      outputs: ["{{outDir}}/source.mkv"],
    },
  ],
};

const overwritePlan: PipelinePlan = {
  version: 1,
  id: "overwrite",
  name: "Overwrite",
  shell: "posix",
  steps: [
    {
      id: "transcode",
      tool: "ffmpeg",
      args: [{ kind: "flag", name: "-hide_banner" }],
      outputs: ["out/web.mp4"],
    },
  ],
};

const unsafePlan: PipelinePlan = {
  version: 1,
  id: "unsafe",
  name: "Unsafe",
  shell: "posix",
  steps: [
    {
      id: "probe",
      tool: "yt-dlp",
      args: [{ kind: "flag", name: "--no-playlist" }],
      unsafe: true,
    },
  ],
};

const detectedUnsafePlan: PipelinePlan = {
  version: 1,
  id: "detected-unsafe",
  name: "Detected unsafe",
  shell: "posix",
  steps: [
    {
      id: "exec",
      tool: "yt-dlp",
      args: [{ kind: "option", name: "--exec", value: "echo {}" }],
    },
  ],
};

const cyclePlan: PipelinePlan = {
  version: 1,
  id: "cycle",
  name: "Cycle",
  shell: "posix",
  steps: [
    { id: "a", tool: "yt-dlp", args: [], dependsOn: ["c"] },
    { id: "b", tool: "ffmpeg", args: [], dependsOn: ["a"] },
    { id: "c", tool: "ffmpeg", args: [], dependsOn: ["b"] },
  ],
};

const missingPlan: PipelinePlan = {
  version: 1,
  id: "missing",
  name: "Missing dependency",
  shell: "posix",
  steps: [{ id: "transcode", tool: "ffmpeg", args: [], dependsOn: ["download"] }],
};

const cleanPlan: PipelinePlan = {
  version: 1,
  id: "clean",
  name: "Clean",
  shell: "posix",
  steps: [
    {
      id: "download",
      tool: "yt-dlp",
      args: [
        { kind: "option", name: "-f", value: "bv*+ba/b" },
        { kind: "value", name: "https://example.com/video" },
      ],
      outputs: ["out/source.mkv"],
    },
    {
      id: "transcode",
      tool: "ffmpeg",
      args: [
        { kind: "flag", name: "-hide_banner" },
        { kind: "option", name: "-i", value: "out/source.mkv" },
        { kind: "value", name: "out/web.mp4" },
      ],
      outputs: ["out/web.mp4"],
      dependsOn: ["download"],
    },
  ],
};

describe("plan safety integration", () => {
  it("reports unbound placeholders as E_UNBOUND_VAR and E_BLOCKED", async () => {
    expect(validatePlan(unboundPlan).ok).toBe(true);
    expect(validateDag(unboundPlan.steps).ok).toBe(true);

    const gate = await runThroughGate(unboundPlan, { force: true });

    expect(gate.findings.map((finding) => finding.code)).toEqual([
      "E_BLOCKED",
      "E_UNBOUND_VAR",
      "E_UNBOUND_VAR",
    ]);

    const blocked = gate.findings.find((finding) => finding.code === "E_BLOCKED");
    expect(blocked?.severity).toBe("error");
    expect(blocked?.message).toContain("{{outDir}}");
    expect(blocked?.message).toContain("{{sourceUrl}}");

    const unbound = gate.findings.filter((finding) => finding.code === "E_UNBOUND_VAR");
    expect(unbound.map((finding) => finding.message)).toEqual([
      'variable "outDir" has no value',
      'variable "sourceUrl" has no value',
    ]);
    expect(gate.calls).toEqual([]);
    expect(gate.results).toEqual([]);
  });

  it("blocks overwrite with E_OVERWRITE unless force is set", async () => {
    const blocked = await runThroughGate(overwritePlan);

    expect(blocked.findings.map((finding) => finding.code)).toEqual(["E_OVERWRITE"]);
    expect(blocked.findings[0].severity).toBe("error");
    expect(blocked.findings[0].location).toBe("out/web.mp4");
    expect(blocked.calls).toEqual([]);
    expect(blocked.results).toEqual([]);

    const forced = await runThroughGate(overwritePlan, { force: true });

    expect(forced.findings).toEqual([]);
    expect(forced.calls).toEqual([["ffmpeg", "-hide_banner"]]);
    expect(forced.results).toHaveLength(1);
    expect(forced.results[0].ok).toBe(true);
  });

  it("honours force from plan defaults", async () => {
    const plan: PipelinePlan = { ...overwritePlan, defaults: { force: true } };
    const gate = await runThroughGate(plan);

    expect(gate.findings).toEqual([]);
    expect(gate.calls).toHaveLength(1);
  });

  it("blocks unsafe steps with E_UNSAFE unless unsafe is set", async () => {
    const blocked = await runThroughGate(unsafePlan);

    expect(blocked.findings.map((finding) => finding.code)).toEqual(["E_UNSAFE"]);
    expect(blocked.findings[0].severity).toBe("error");
    expect(blocked.calls).toEqual([]);
    expect(blocked.results).toEqual([]);

    const allowed = await runThroughGate(unsafePlan, { unsafe: true });

    expect(allowed.findings).toEqual([]);
    expect(allowed.calls).toEqual([["yt-dlp", "--no-playlist"]]);
    expect(allowed.results[0].ok).toBe(true);
  });

  it("honours unsafe from plan defaults", async () => {
    const plan: PipelinePlan = { ...unsafePlan, defaults: { unsafe: true } };
    const gate = await runThroughGate(plan);

    expect(gate.findings).toEqual([]);
    expect(gate.calls).toHaveLength(1);
  });

  it("detects unsafe yt-dlp flags through the real adapter", async () => {
    expect(collectGuards(detectedUnsafePlan, { force: true })).toEqual([]);
    expect(adapterFor("yt-dlp").requiresUnsafe(detectedUnsafePlan.steps[0])).toBe(true);

    const blocked = await runThroughGate(detectedUnsafePlan, { force: true });

    expect(blocked.calls).toEqual([]);
    expect(blocked.results).toHaveLength(1);
    expect(blocked.results[0].ok).toBe(false);
    expect(blocked.results[0].findings.some((finding) => finding.code === "E_UNSAFE")).toBe(true);

    const allowed = await runThroughGate(detectedUnsafePlan, { force: true, unsafe: true });

    expect(allowed.calls).toHaveLength(1);
    expect(allowed.results[0].ok).toBe(true);
  });

  it("detects unsafe ffmpeg stream formats through the real adapter", async () => {
    const plan: PipelinePlan = {
      version: 1,
      id: "hls",
      name: "HLS",
      shell: "posix",
      steps: [
        {
          id: "segment",
          tool: "ffmpeg",
          args: [{ kind: "option", name: "-f", value: "hls" }],
          outputs: ["out/playlist.m3u8"],
        },
      ],
    };

    expect(collectGuards(plan, { force: true })).toEqual([]);
    expect(adapterFor("ffmpeg").requiresUnsafe(plan.steps[0])).toBe(true);

    const blocked = await runThroughGate(plan, { force: true });

    expect(blocked.calls).toEqual([]);
    expect(blocked.results[0].findings.some((finding) => finding.code === "E_UNSAFE")).toBe(true);
  });

  it("blocks dependency cycles before execution", async () => {
    const dag = validateDag(cyclePlan.steps);

    expect(dag.ok).toBe(false);
    expect(dag.findings.some((finding) => finding.code === "E_CYCLE")).toBe(true);

    const gate = await runThroughGate(cyclePlan);

    expect(gate.findings.some((finding) => finding.code === "E_CYCLE")).toBe(true);
    expect(gate.calls).toEqual([]);
    expect(gate.results).toEqual([]);
  });

  it("blocks missing dependencies before execution", async () => {
    const dag = validateDag(missingPlan.steps);

    expect(dag.ok).toBe(false);
    expect(dag.findings.map((finding) => finding.code)).toEqual(["E_MISSING_DEP"]);
    expect(dag.findings[0].message).toContain('"download"');

    const gate = await runThroughGate(missingPlan);

    expect(gate.findings.some((finding) => finding.code === "E_MISSING_DEP")).toBe(true);
    expect(gate.calls).toEqual([]);
    expect(gate.results).toEqual([]);
  });

  it("stops executePlan itself when the DAG has a cycle", async () => {
    const calls: string[][] = [];
    const run: ProcessRunner = (argv) => {
      calls.push([...argv]);
      return { exitCode: 0, stdout: "", stderr: "" };
    };
    const verify: VerifyFn = (result) => result;

    const results = await executePlan(cyclePlan, plannerAdapters, {
      dryRun: false,
      run,
      verify,
    });

    expect(results).toHaveLength(1);
    expect(results[0].stepId).toBe("cycle");
    expect(results[0].findings.some((finding) => finding.code === "E_CYCLE")).toBe(true);
    expect(calls).toEqual([]);
  });

  it("blocks malformed plans before guards and execution", async () => {
    const gate = await runThroughGate({
      version: 2,
      id: "",
      name: "Bad",
      shell: "bash",
      steps: [{ id: "probe", tool: "curl", args: [] }],
    });

    expect(gate.findings.some((finding) => finding.code === "E_UNKNOWN_VERSION")).toBe(true);
    expect(gate.findings.some((finding) => finding.code === "E_MISSING_ID")).toBe(true);
    expect(gate.findings.some((finding) => finding.code === "E_UNKNOWN_TOOL")).toBe(true);
    expect(gate.calls).toEqual([]);
    expect(gate.results).toEqual([]);
  });

  it("executes a clean plan in dependency order", async () => {
    const gate = await runThroughGate(cleanPlan, { force: true });

    expect(gate.findings).toEqual([]);
    expect(gate.calls.map((argv) => argv[0])).toEqual(["yt-dlp", "ffmpeg"]);
    expect(gate.results.map((result) => result.stepId)).toEqual(["download", "transcode"]);
    expect(gate.results.every((result) => result.ok)).toBe(true);
  });

  it("starts no process when findings contain errors", async () => {
    const plans = [unboundPlan, overwritePlan, unsafePlan, cyclePlan, missingPlan];

    for (const plan of plans) {
      const gate = await runThroughGate(plan);
      expect(gate.findings.some((finding) => finding.severity === "error")).toBe(true);
      expect(gate.calls).toEqual([]);
    }
  });
});
