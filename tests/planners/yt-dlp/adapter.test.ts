import { describe, expect, it } from "vitest";
import type { Recipe, Step } from "../../../src/core/index.js";
import { ytDlpAdapter } from "../../../src/planners/yt-dlp/index.js";

const VIDEO_RECIPE: Recipe = {
  id: "best-video",
  name: "Best video",
  tool: "yt-dlp",
  args: [
    { kind: "option", name: "-f", value: "bv*+ba/b" },
    { kind: "option", name: "-o", values: ["{{outputDir}}/{{name}}.%(ext)s"] },
    { kind: "flag", name: "--no-playlist" },
    { kind: "value", name: "{{url}}" },
  ],
};

function stepFrom(recipe: Recipe, overrides: Partial<Step> = {}): Step {
  return {
    id: "download",
    tool: recipe.tool,
    recipeId: recipe.id,
    args: recipe.args,
    ...overrides,
  };
}

const VARS = {
  url: "https://example.com/video",
  outputDir: "out",
  name: "clip",
};

describe("yt-dlp planner", () => {
  it("binds vars in args and preserves arg kinds", () => {
    const result = ytDlpAdapter.planFromStep(stepFrom(VIDEO_RECIPE), VARS);

    expect(result.findings).toEqual([]);
    expect(result.args).toEqual([
      { kind: "option", name: "-f", value: "bv*+ba/b" },
      { kind: "option", name: "-o", values: ["out/clip.%(ext)s"] },
      { kind: "flag", name: "--no-playlist" },
      { kind: "value", name: "https://example.com/video" },
    ]);
  });

  it("binds angle placeholders and alias values", () => {
    const recipe: Recipe = {
      id: "angle",
      name: "Angle placeholders",
      tool: "yt-dlp",
      args: [{ kind: "option", name: "--format", alias: "-f", value: "<format>" }],
    };

    const result = ytDlpAdapter.planFromStep(stepFrom(recipe), { format: "22" });

    expect(result.findings).toEqual([]);
    expect(result.args).toEqual([{ kind: "option", name: "--format", alias: "-f", value: "22" }]);
  });

  it("reports unbound placeholders once per name", () => {
    const recipe: Recipe = {
      id: "unbound",
      name: "Unbound placeholders",
      tool: "yt-dlp",
      args: [
        { kind: "option", name: "-o", values: ["{{outputDir}}/{{name}}.mkv", "{{name}}.part"] },
        { kind: "value", name: "{{url}}" },
      ],
    };

    const result = ytDlpAdapter.planFromStep(stepFrom(recipe), { url: VARS.url });

    expect(result.findings).toEqual([
      {
        severity: "error",
        code: "E_UNBOUND_VAR",
        message: 'variable "outputDir" has no value',
        location: "step:download",
        fix: "define vars.outputDir",
      },
      {
        severity: "error",
        code: "E_UNBOUND_VAR",
        message: 'variable "name" has no value',
        location: "step:download",
        fix: "define vars.name",
      },
    ]);
    expect(result.args[0]).toEqual({
      kind: "option",
      name: "-o",
      values: ["{{outputDir}}/{{name}}.mkv", "{{name}}.part"],
    });
  });

  it("reports a tool mismatch finding", () => {
    const result = ytDlpAdapter.planFromStep(
      stepFrom(VIDEO_RECIPE, { tool: "ffmpeg" }),
      VARS,
    );

    expect(result.findings).toEqual([
      {
        severity: "error",
        code: "E_TOOL_MISMATCH",
        message: 'step "download" uses tool "ffmpeg", adapter handles "yt-dlp"',
        location: "step:download",
      },
    ]);
  });

  it("marks exec flags and dash output as unsafe", () => {
    const base = stepFrom(VIDEO_RECIPE);

    expect(ytDlpAdapter.requiresUnsafe(base)).toBe(false);
    expect(
      ytDlpAdapter.requiresUnsafe({
        ...base,
        args: [{ kind: "option", name: "--exec", value: "ffmpeg -i {} {}" }],
      }),
    ).toBe(true);
    expect(
      ytDlpAdapter.requiresUnsafe({
        ...base,
        args: [{ kind: "option", name: "--exec-before-download", value: "echo {}" }],
      }),
    ).toBe(true);
    expect(
      ytDlpAdapter.requiresUnsafe({
        ...base,
        args: [{ kind: "option", name: "-o", value: "-" }],
      }),
    ).toBe(true);
    expect(
      ytDlpAdapter.requiresUnsafe({
        ...base,
        args: [{ kind: "option", name: "--output", alias: "-o", values: ["-"] }],
      }),
    ).toBe(true);
    expect(ytDlpAdapter.requiresUnsafe({ ...base, unsafe: true })).toBe(true);
  });

  it("uses step verification when present", () => {
    const verify = { command: "test -f out/clip.mkv" };
    const step = stepFrom(VIDEO_RECIPE, { verify, outputs: ["out/clip.mkv"] });

    expect(ytDlpAdapter.defaultVerify(step)).toBe(verify);
  });

  it("defaults verification to output existence and exit code zero", () => {
    const step = stepFrom(VIDEO_RECIPE, { outputs: ["out/clip.mkv"] });

    expect(ytDlpAdapter.defaultVerify(step)).toEqual({
      exists: ["out/clip.mkv"],
      expectExitCode: 0,
    });
  });

  it("defaults verification to exit code zero without outputs", () => {
    expect(ytDlpAdapter.defaultVerify(stepFrom(VIDEO_RECIPE))).toEqual({
      expectExitCode: 0,
    });
  });
});
