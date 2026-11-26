import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { StepResult } from "../../src/core/index.js";
import { verifyStep } from "../../src/runner/verify.js";
import type { CommandOutcome } from "../../src/runner/verify.js";

let dir = "";
let media = "";
let empty = "";

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "orbit-verify-"));
  media = join(dir, "out.mp4");
  empty = join(dir, "empty.mp4");
  await writeFile(media, "stand-in-container-bytes");
  await writeFile(empty, "");
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

function okResult(stepId = "transcode"): StepResult {
  return { stepId, ok: true, exitCode: 0, stdout: "done", stderr: "", findings: [] };
}

function fakeRunner(outcome: CommandOutcome): {
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

const probeOk: CommandOutcome = { code: 0, stdout: "{}", stderr: "" };
const probeFail: CommandOutcome = {
  code: 1,
  stdout: "",
  stderr: "Invalid data found when processing input",
};

describe("verifyStep files on disk", () => {
  it("accepts an existing non-empty file", async () => {
    const result = await verifyStep(okResult(), { exists: [media] });

    expect(result.ok).toBe(true);
    expect(result.findings).toEqual([]);
  });

  it("reports a missing file", async () => {
    const missing = join(dir, "absent.mp4");

    const result = await verifyStep(okResult("download"), { exists: [missing] });

    expect(result.ok).toBe(false);
    const finding = result.findings.find((entry) => entry.code === "E_OUTPUT_MISSING");
    expect(finding?.severity).toBe("error");
    expect(finding?.location).toBe(missing);
  });

  it("reports an empty file", async () => {
    const result = await verifyStep(okResult("download"), { exists: [empty] });

    expect(result.ok).toBe(false);
    const finding = result.findings.find((entry) => entry.code === "E_OUTPUT_EMPTY");
    expect(finding?.severity).toBe("error");
    expect(finding?.location).toBe(empty);
  });

  it("checks every listed file", async () => {
    const result = await verifyStep(okResult(), { exists: [media, empty] });

    expect(result.ok).toBe(false);
    expect(result.findings.map((entry) => entry.code)).toEqual(["E_OUTPUT_EMPTY"]);
  });
});

describe("verifyStep ffprobe commands", () => {
  it("passes when ffprobe succeeds", async () => {
    const command = fakeRunner(probeOk);
    const spec = { exists: [media], command: `ffprobe -v error ${media}` };

    const result = await verifyStep(okResult(), spec, { run: command.run });

    expect(result.ok).toBe(true);
    expect(result.findings).toEqual([]);
    expect(command.calls).toEqual([`ffprobe -v error ${media}`]);
  });

  it("fails when ffprobe rejects the file", async () => {
    const command = fakeRunner(probeFail);

    const result = await verifyStep(
      okResult(),
      { exists: [media], command: `ffprobe -v error ${media}` },
      { run: command.run },
    );

    expect(result.ok).toBe(false);
    const finding = result.findings.find((entry) => entry.code === "E_VERIFY_COMMAND");
    expect(finding?.message).toContain("code 1");
    expect(finding?.message).toContain("Invalid data found when processing input");
    expect(finding?.location).toBe("step:transcode");
  });

  it("does not mask a missing file with a good probe", async () => {
    const command = fakeRunner(probeOk);
    const missing = join(dir, "absent.mkv");

    const result = await verifyStep(
      okResult(),
      { exists: [missing], command: `ffprobe ${missing}` },
      { run: command.run },
    );

    expect(result.ok).toBe(false);
    expect(result.findings.some((entry) => entry.code === "E_OUTPUT_MISSING")).toBe(true);
  });
});

describe("verifyStep explicit commands", () => {
  it("runs an explicit verify command once", async () => {
    const command = fakeRunner({ code: 0, stdout: "ok", stderr: "" });
    const spec = { command: `test -s ${media}` };

    const result = await verifyStep(okResult(), spec, { run: command.run });

    expect(result.ok).toBe(true);
    expect(command.calls).toEqual([`test -s ${media}`]);
  });

  it("reports a failed command without stderr", async () => {
    const command = fakeRunner({ code: 2, stdout: "", stderr: "  " });

    const result = await verifyStep(okResult(), { command: "false" }, { run: command.run });

    expect(result.ok).toBe(false);
    const finding = result.findings.find((entry) => entry.code === "E_VERIFY_COMMAND");
    expect(finding?.message).toBe("verification command failed with code 2");
  });

  it("reports a thrown command as a finding", async () => {
    const run = (): CommandOutcome => {
      throw new Error("spawn failed");
    };

    const result = await verifyStep(okResult(), { command: "ffprobe" }, { run });

    expect(result.ok).toBe(false);
    const finding = result.findings.find((entry) => entry.code === "E_VERIFY_COMMAND");
    expect(finding?.message).toContain("spawn failed");
  });

  it("skips a blank command", async () => {
    const command = fakeRunner(probeOk);

    const result = await verifyStep(okResult(), { command: "   " }, { run: command.run });

    expect(result.ok).toBe(true);
    expect(result.findings).toEqual([]);
    expect(command.calls).toEqual([]);
  });
});

describe("verifyStep exit code checks", () => {
  it("accepts the expected code", async () => {
    const result = await verifyStep(okResult(), { expectExitCode: 0 });

    expect(result.ok).toBe(true);
    expect(result.findings).toEqual([]);
  });

  it("rejects a different code", async () => {
    const result = await verifyStep(
      { ...okResult("download"), ok: false, exitCode: 2 },
      { expectExitCode: 0 },
    );

    expect(result.ok).toBe(false);
    const finding = result.findings.find((entry) => entry.code === "E_VERIFY_EXIT");
    expect(finding?.severity).toBe("error");
    expect(finding?.message).toBe("expected exit code 0, got 2");
  });

  it("warns when the code is unknown", async () => {
    const unknown: StepResult = {
      stepId: "transcode",
      ok: true,
      stdout: "",
      stderr: "",
      findings: [],
    };

    const result = await verifyStep(unknown, { expectExitCode: 0 });

    expect(result.ok).toBe(true);
    const finding = result.findings.find((entry) => entry.code === "W_EXIT_UNKNOWN");
    expect(finding?.severity).toBe("warning");
    expect(result.findings.some((entry) => entry.severity === "error")).toBe(false);
  });

  it("keeps findings that arrived with the step result", async () => {
    const prior: StepResult = {
      ...okResult(),
      ok: false,
      findings: [{ severity: "error", code: "E_STEP_FAILED", message: "step failed" }],
    };

    const result = await verifyStep(prior, { exists: [media], expectExitCode: 0 });

    expect(result.ok).toBe(false);
    expect(result.findings.map((entry) => entry.code)).toEqual(["E_STEP_FAILED"]);
  });
});

describe("verifyStep combined spec", () => {
  it("passes file, probe, and exit checks together", async () => {
    const command = fakeRunner(probeOk);
    const spec = { exists: [media], expectExitCode: 0, command: `ffprobe ${media}` };

    const result = await verifyStep(okResult("transcode"), spec, { run: command.run });

    expect(result.ok).toBe(true);
    expect(result.findings).toEqual([]);
    expect(result.stepId).toBe("transcode");
    expect(command.calls).toHaveLength(1);
  });

  it("collects every failure in one pass", async () => {
    const command = fakeRunner(probeFail);
    const missing = join(dir, "absent.mp4");
    const spec = {
      exists: [missing, empty],
      expectExitCode: 0,
      command: `ffprobe ${missing}`,
    };

    const result = await verifyStep(
      { ...okResult(), ok: false, exitCode: 3 },
      spec,
      { run: command.run },
    );

    expect(result.ok).toBe(false);
    expect(result.findings.map((entry) => entry.code)).toEqual([
      "E_VERIFY_EXIT",
      "E_OUTPUT_MISSING",
      "E_OUTPUT_EMPTY",
      "E_VERIFY_COMMAND",
    ]);
  });
});
