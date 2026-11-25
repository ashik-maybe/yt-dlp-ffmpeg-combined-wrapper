import { describe, expect, it } from "vitest";
import type {
  ArgKind,
  Command,
  Confidence,
  Defaults,
  Finding,
  PipelinePlan,
  Plan,
  PlanArg,
  Recipe,
  Severity,
  Shell,
  Step,
  StepResult,
  Tool,
  VerifySpec,
} from "../../src/core/types.js";

describe("core types", () => {
  it("accepts a valid pipeline plan shape", () => {
    const arg: PlanArg = { kind: "option", name: "output", value: "out.mp4" };
    const step: Step = {
      id: "s1",
      tool: "ffmpeg",
      recipeId: "r1",
      args: [arg],
      inputs: ["in.mp4"],
      outputs: ["out.mp4"],
      dependsOn: [],
      unsafe: false,
      verify: { exists: ["out.mp4"] },
    };
    const plan: PipelinePlan = {
      version: 1,
      id: "p1",
      name: "plan",
      shell: "posix",
      vars: { input: "in.mp4" },
      defaults: { force: false, unsafe: false },
      steps: [step],
    };

    const tool: Tool = plan.steps[0].tool;
    const shell: Shell = plan.shell;
    const kind: ArgKind = arg.kind;
    const severity: Severity = "error";
    const confidence: Confidence = "verified";

    expect(tool).toBe("ffmpeg");
    expect(shell).toBe("posix");
    expect(kind).toBe("option");
    expect(severity).toBe("error");
    expect(confidence).toBe("verified");
    expect(plan.version).toBe(1);
  });

  it("supports command, recipe, plan, finding, and step result", () => {
    const command: Command = {
      tool: "yt-dlp",
      args: [{ kind: "value", name: "url", value: "https://example.com" }],
      shell: "posix",
    };
    const recipe: Recipe = {
      id: "r1",
      name: "Download",
      tool: "yt-dlp",
      args: command.args,
      confidence: "validated",
    };
    const plan: Plan = {
      tool: "yt-dlp",
      args: recipe.args,
      shell: "posix",
      confidence: "validated",
    };
    const finding: Finding = {
      severity: "warning",
      code: "W_TEST",
      message: "test",
      location: "here",
      fix: "fix",
    };
    const verify: VerifySpec = { command: "echo ok", expectExitCode: 0 };
    const defaults: Defaults = { shell: "posix", force: true, unsafe: false };
    const result: StepResult = {
      stepId: "s1",
      ok: true,
      exitCode: 0,
      stdout: "ok",
      stderr: "",
      findings: [finding],
    };

    expect(command.tool).toBe("yt-dlp");
    expect(recipe.id).toBe("r1");
    expect(plan.confidence).toBe("validated");
    expect(verify.expectExitCode).toBe(0);
    expect(defaults.force).toBe(true);
    expect(result.findings[0].code).toBe("W_TEST");
  });
});
