import { describe, expect, it } from "vitest";
import { downloadTranscodePlan, toolAdapters } from "../../src/contracts/index.js";
import type { PipelinePlan, StepResult, VerifySpec } from "../../src/core/index.js";
import { executePlan } from "../../src/runner/execute.js";
import type { ProcessOutcome } from "../../src/runner/execute.js";
import { verifyStep } from "../../src/runner/verify.js";
import type { CommandOutcome } from "../../src/runner/verify.js";

function okResult(stepId = "step"): StepResult {
  return { stepId, ok: true, exitCode: 0, stdout: "", stderr: "", findings: [] };
}

function fakeCommand(outcome: CommandOutcome): {
  calls: string[];
  run: (command: string) => CommandOutcome;
} {
  const calls: string[] = [];
  return {
    calls,
    run(command) {
      calls.push(command);
      return outcome;
    },
  };
}

describe("verifyStep", () => {
  it("passes when exit code, outputs, and probe succeed", async () => {
    const command = fakeCommand({ code: 0, stdout: "{}", stderr: "" });
    const sizes: Record<string, number> = { "out.mp4": 2048 };

    const result = await verifyStep(
      okResult("transcode"),
      { command: "ffprobe -v error out.mp4", exists: ["out.mp4"], expectExitCode: 0 },
      { run: command.run, sizeOf: (path) => sizes[path] },
    );

    expect(result.ok).toBe(true);
    expect(result.findings).toEqual([]);
    expect(command.calls).toEqual(["ffprobe -v error out.mp4"]);
  });

  it("reports a missing output", async () => {
    const result = await verifyStep(
      okResult("download"),
      { exists: ["missing.mkv"] },
      { sizeOf: () => undefined },
    );

    expect(result.ok).toBe(false);
    expect(result.findings.some((finding) => finding.code === "E_OUTPUT_MISSING")).toBe(true);
  });

  it("reports an empty output", async () => {
    const result = await verifyStep(
      okResult("download"),
      { exists: ["empty.mkv"] },
      { sizeOf: () => 0 },
    );

    expect(result.ok).toBe(false);
    expect(result.findings.some((finding) => finding.code === "E_OUTPUT_EMPTY")).toBe(true);
  });

  it("reports a failed ffprobe command", async () => {
    const command = fakeCommand({ code: 1, stdout: "", stderr: "Invalid data found" });

    const result = await verifyStep(
      okResult("transcode"),
      { command: "ffprobe bad.mp4" },
      { run: command.run, sizeOf: () => 1024 },
    );

    expect(result.ok).toBe(false);
    const finding = result.findings.find((entry) => entry.code === "E_VERIFY_COMMAND");
    expect(finding?.message).toContain("Invalid data found");
  });

  it("reports an unexpected exit code", async () => {
    const result = await verifyStep(
      { ...okResult("download"), ok: false, exitCode: 1 },
      { expectExitCode: 0 },
      { sizeOf: () => 1024 },
    );

    expect(result.ok).toBe(false);
    expect(result.findings.some((finding) => finding.code === "E_VERIFY_EXIT")).toBe(true);
  });
});

describe("executePlan", () => {
  it("runs in topological order and defaults to dry-run", async () => {
    const plan: PipelinePlan = {
      version: 1,
      id: "order",
      name: "Order",
      shell: "posix",
      steps: [
        { id: "second", tool: "ffmpeg", args: [], dependsOn: ["first"], outputs: ["b.mp4"] },
        { id: "first", tool: "yt-dlp", args: [], outputs: ["a.mkv"] },
      ],
    };
    const calls: string[][] = [];
    const run = (argv: readonly string[]): ProcessOutcome => {
      calls.push([...argv]);
      return { exitCode: 0, stdout: "", stderr: "" };
    };

    const results = await executePlan(plan, toolAdapters, { run });

    expect(results.map((result) => result.stepId)).toEqual(["first", "second"]);
    expect(results.every((result) => result.ok)).toBe(true);
    expect(calls).toEqual([]);
    expect(results[0].findings.some((finding) => finding.code === "I_DRY_RUN")).toBe(true);
  });

  it("executes and verifies bound specs when dryRun is false", async () => {
    const plan = downloadTranscodePlan();
    const calls: string[][] = [];
    const specs: VerifySpec[] = [];
    const run = (argv: readonly string[]): ProcessOutcome => {
      calls.push([...argv]);
      return { exitCode: 0, stdout: "done", stderr: "" };
    };
    const verify = (result: StepResult, spec: VerifySpec): StepResult => {
      specs.push(spec);
      return result;
    };

    const results = await executePlan(plan, toolAdapters, { dryRun: false, run, verify });

    expect(results.map((result) => result.stepId)).toEqual(["download", "transcode"]);
    expect(results.every((result) => result.ok)).toBe(true);
    expect(calls.map((argv) => argv[0])).toEqual(["yt-dlp", "ffmpeg"]);
    expect(specs).toEqual([{ exists: ["out/source.mkv"] }, { exists: ["out/web.mp4"] }]);
  });

  it("stops after a failed step", async () => {
    const plan = downloadTranscodePlan();
    let calls = 0;
    let verifyCalls = 0;
    const run = (): ProcessOutcome => {
      calls += 1;
      return { exitCode: 2, stdout: "", stderr: "boom" };
    };
    const verify = (result: StepResult): StepResult => {
      verifyCalls += 1;
      return result;
    };

    const results = await executePlan(plan, toolAdapters, { dryRun: false, run, verify });

    expect(results).toHaveLength(1);
    expect(results[0].ok).toBe(false);
    expect(results[0].exitCode).toBe(2);
    expect(results[0].stderr).toBe("boom");
    expect(results[0].findings.some((finding) => finding.code === "E_STEP_FAILED")).toBe(true);
    expect(calls).toBe(1);
    expect(verifyCalls).toBe(0);
  });

  it("stops before running when an output variable is unbound", async () => {
    const plan: PipelinePlan = {
      version: 1,
      id: "unbound",
      name: "Unbound",
      shell: "posix",
      steps: [
        {
          id: "download",
          tool: "yt-dlp",
          args: [{ kind: "option", name: "-o", value: "{{outPath}}/source.mkv" }],
          outputs: ["{{outPath}}/source.mkv"],
        },
      ],
    };
    let calls = 0;
    const run = (): ProcessOutcome => {
      calls += 1;
      return { exitCode: 0, stdout: "", stderr: "" };
    };

    const results = await executePlan(plan, toolAdapters, { dryRun: false, run });

    expect(results).toHaveLength(1);
    expect(results[0].ok).toBe(false);
    expect(results[0].findings.some((finding) => finding.code === "E_BLOCKED")).toBe(true);
    expect(calls).toBe(0);
  });

  it("stops when verification fails", async () => {
    const plan = downloadTranscodePlan();
    let calls = 0;
    const run = (): ProcessOutcome => {
      calls += 1;
      return { exitCode: 0, stdout: "", stderr: "" };
    };
    const verify = (result: StepResult): StepResult => ({
      ...result,
      ok: false,
      findings: [
        ...result.findings,
        { severity: "error", code: "E_FAKE_VERIFY", message: "verification failed" },
      ],
    });

    const results = await executePlan(plan, toolAdapters, { dryRun: false, run, verify });

    expect(results).toHaveLength(1);
    expect(results[0].ok).toBe(false);
    expect(calls).toBe(1);
  });
});
