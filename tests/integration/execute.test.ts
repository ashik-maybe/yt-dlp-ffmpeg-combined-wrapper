import { describe, expect, it } from "vitest";
import { downloadTranscodePlan } from "../../src/contracts/index.js";
import type { Step, StepResult, VerifySpec } from "../../src/core/index.js";
import { plannerAdapters } from "../../src/planners/index.js";
import { executePlan } from "../../src/runner/index.js";
import type { ProcessOutcome } from "../../src/runner/index.js";

const DOWNLOAD_ARGV: readonly string[] = [
  "yt-dlp",
  "-f",
  "bv*+ba/b",
  "--merge-output-format",
  "mkv",
  "-o",
  "out/source.%(ext)s",
  "--no-playlist",
  "https://example.com/video",
];

const TRANSCODE_ARGV: readonly string[] = [
  "ffmpeg",
  "-hide_banner",
  "-i",
  "out/source.mkv",
  "-c:v",
  "libx264",
  "-preset",
  "medium",
  "-crf",
  "23",
  "-c:a",
  "aac",
  "-b:a",
  "128k",
  "-movflags",
  "+faststart",
  "out/web.mp4",
];

interface RecordedCall {
  readonly stepId: string;
  readonly argv: readonly string[];
}

interface RecordedVerify {
  readonly stepId: string;
  readonly spec: VerifySpec;
}

function fakeRunner(exitCodes: Readonly<Record<string, number>> = {}): {
  readonly calls: RecordedCall[];
  readonly run: (argv: readonly string[], step: Step) => ProcessOutcome;
} {
  const calls: RecordedCall[] = [];
  return {
    calls,
    run(argv, step) {
      calls.push({ stepId: step.id, argv: [...argv] });
      const exitCode = exitCodes[step.id] ?? 0;
      return {
        exitCode,
        stdout: `${step.id}-stdout`,
        stderr: exitCode === 0 ? "" : `${step.id}-stderr`,
      };
    },
  };
}

function fakeVerifier(): {
  readonly calls: RecordedVerify[];
  readonly verify: (result: StepResult, spec: VerifySpec) => StepResult;
} {
  const calls: RecordedVerify[] = [];
  return {
    calls,
    verify(result, spec) {
      calls.push({ stepId: result.stepId, spec });
      return result;
    },
  };
}

describe("executePlan integration", () => {
  it("runs both planned steps in dependency order with exact argv", async () => {
    const plan = downloadTranscodePlan();
    const runner = fakeRunner();
    const verifier = fakeVerifier();

    const results = await executePlan(plan, plannerAdapters, {
      dryRun: false,
      run: runner.run,
      verify: verifier.verify,
    });

    expect(runner.calls).toEqual([
      { stepId: "download", argv: DOWNLOAD_ARGV },
      { stepId: "transcode", argv: TRANSCODE_ARGV },
    ]);
    expect(verifier.calls).toEqual([
      { stepId: "download", spec: { exists: ["out/source.mkv"] } },
      { stepId: "transcode", spec: { exists: ["out/web.mp4"] } },
    ]);
    expect(results).toEqual([
      {
        stepId: "download",
        ok: true,
        exitCode: 0,
        stdout: "download-stdout",
        stderr: "",
        findings: [],
      },
      {
        stepId: "transcode",
        ok: true,
        exitCode: 0,
        stdout: "transcode-stdout",
        stderr: "",
        findings: [],
      },
    ]);
  });

  it("keeps dependency order when steps are declared in reverse", async () => {
    const plan = downloadTranscodePlan();
    const reversed = { ...plan, steps: [...plan.steps].reverse() };
    const runner = fakeRunner();
    const verifier = fakeVerifier();

    const results = await executePlan(reversed, plannerAdapters, {
      dryRun: false,
      run: runner.run,
      verify: verifier.verify,
    });

    expect(runner.calls.map((call) => call.stepId)).toEqual(["download", "transcode"]);
    expect(runner.calls.map((call) => call.argv)).toEqual([DOWNLOAD_ARGV, TRANSCODE_ARGV]);
    expect(verifier.calls.map((call) => call.stepId)).toEqual(["download", "transcode"]);
    expect(results.map((result) => result.stepId)).toEqual(["download", "transcode"]);
  });

  it("spawns nothing and verifies nothing in dry-run", async () => {
    const plan = downloadTranscodePlan();
    const runner = fakeRunner();
    const verifier = fakeVerifier();

    const results = await executePlan(plan, plannerAdapters, {
      dryRun: true,
      run: runner.run,
      verify: verifier.verify,
    });

    expect(runner.calls).toEqual([]);
    expect(verifier.calls).toEqual([]);
    expect(results.map((result) => result.stepId)).toEqual(["download", "transcode"]);
    expect(results.map((result) => result.ok)).toEqual([true, true]);
    expect(results.map((result) => result.findings.map((finding) => finding.code))).toEqual([
      ["I_DRY_RUN"],
      ["I_DRY_RUN"],
    ]);
    expect(results.map((result) => result.findings.map((finding) => finding.message))).toEqual([
      [`dry run: ${DOWNLOAD_ARGV.join(" ")}`],
      [`dry run: ${TRANSCODE_ARGV.join(" ")}`],
    ]);
  });

  it("stops after the first process failure", async () => {
    const plan = downloadTranscodePlan();
    const runner = fakeRunner({ download: 1 });
    const verifier = fakeVerifier();

    const results = await executePlan(plan, plannerAdapters, {
      dryRun: false,
      run: runner.run,
      verify: verifier.verify,
    });

    expect(runner.calls).toEqual([{ stepId: "download", argv: DOWNLOAD_ARGV }]);
    expect(verifier.calls).toEqual([]);
    expect(results).toEqual([
      {
        stepId: "download",
        ok: false,
        exitCode: 1,
        stdout: "download-stdout",
        stderr: "download-stderr",
        findings: [
          {
            severity: "error",
            code: "E_STEP_FAILED",
            message: 'step "download" exited with code 1',
            location: "step:download",
          },
        ],
      },
    ]);
  });

  it("stops after the first verification failure", async () => {
    const plan = downloadTranscodePlan();
    const runner = fakeRunner();
    const specs: VerifySpec[] = [];
    const verify = (result: StepResult, spec: VerifySpec): StepResult => {
      specs.push(spec);
      if (result.stepId !== "download") return result;
      return {
        ...result,
        ok: false,
        findings: [
          ...result.findings,
          {
            severity: "error",
            code: "E_FAKE_VERIFY",
            message: "output check failed",
            location: `step:${result.stepId}`,
          },
        ],
      };
    };

    const results = await executePlan(plan, plannerAdapters, {
      dryRun: false,
      run: runner.run,
      verify,
    });

    expect(runner.calls).toEqual([{ stepId: "download", argv: DOWNLOAD_ARGV }]);
    expect(specs).toEqual([{ exists: ["out/source.mkv"] }]);
    expect(results).toEqual([
      {
        stepId: "download",
        ok: false,
        exitCode: 0,
        stdout: "download-stdout",
        stderr: "",
        findings: [
          {
            severity: "error",
            code: "E_FAKE_VERIFY",
            message: "output check failed",
            location: "step:download",
          },
        ],
      },
    ]);
  });
});
