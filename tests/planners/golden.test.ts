import { describe, expect, it } from "vitest";
import { downloadTranscodePlan } from "../../src/contracts/index.js";
import type { PlanArg, Step } from "../../src/core/index.js";
import { renderArg, renderCommand } from "../../src/core/index.js";
import {
  adapterFor,
  ffmpegAdapter,
  plannerAdapters,
  ytDlpAdapter,
} from "../../src/planners/index.js";

const PLAN = downloadTranscodePlan();
const VARS = PLAN.vars ?? {};

function fixtureStep(id: string): Step {
  const found = PLAN.steps.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`fixture step "${id}" is missing`);
  return found;
}

function resolve(id: string, vars: Readonly<Record<string, string>> = VARS) {
  const step = fixtureStep(id);
  return { step, ...adapterFor(step.tool).planFromStep(step, vars) };
}

function commandLine(step: Step, args: readonly PlanArg[]): string {
  return [step.tool, ...args.map(renderArg)].join(" ");
}

function variant(id: string, args: readonly PlanArg[], unsafe = false): Step {
  return { ...fixtureStep(id), args, ...(unsafe ? { unsafe: true } : {}) };
}

describe("planner registry", () => {
  it("maps every tool to its dedicated adapter", () => {
    expect(Object.keys(plannerAdapters).sort()).toEqual(["ffmpeg", "yt-dlp"]);
    expect(plannerAdapters["yt-dlp"]).toBe(ytDlpAdapter);
    expect(plannerAdapters.ffmpeg).toBe(ffmpegAdapter);
    expect(adapterFor("yt-dlp")).toBe(ytDlpAdapter);
    expect(adapterFor("ffmpeg")).toBe(ffmpegAdapter);
  });

  it("reports the tool on each adapter", () => {
    expect(adapterFor("yt-dlp").tool).toBe("yt-dlp");
    expect(adapterFor("ffmpeg").tool).toBe("ffmpeg");
  });
});

describe("download-transcode golden commands", () => {
  it("renders the yt-dlp download step", () => {
    const { step, args, findings } = resolve("download");

    expect(findings).toEqual([]);
    expect(args).toEqual([
      { kind: "option", name: "-f", value: "bv*+ba/b" },
      { kind: "option", name: "--merge-output-format", value: "mkv" },
      { kind: "option", name: "-o", values: ["out/source.%(ext)s"] },
      { kind: "flag", name: "--no-playlist" },
      { kind: "value", name: "https://example.com/video" },
    ]);
    expect(renderCommand(step.tool, args)).toEqual([
      "yt-dlp",
      "-f",
      "bv*+ba/b",
      "--merge-output-format",
      "mkv",
      "-o",
      "out/source.%(ext)s",
      "--no-playlist",
      "https://example.com/video",
    ]);
    expect(args.map(renderArg)).toEqual([
      "-f 'bv*+ba/b'",
      "--merge-output-format mkv",
      "-o 'out/source.%(ext)s'",
      "--no-playlist",
      "https://example.com/video",
    ]);
    expect(commandLine(step, args)).toBe(
      "yt-dlp -f 'bv*+ba/b' --merge-output-format mkv -o 'out/source.%(ext)s' --no-playlist https://example.com/video",
    );
  });

  it("renders the ffmpeg transcode step", () => {
    const { step, args, findings } = resolve("transcode");

    expect(findings).toEqual([]);
    expect(args).toEqual([
      { kind: "flag", name: "-hide_banner" },
      { kind: "option", name: "-i", value: "out/source.mkv" },
      { kind: "option", name: "-c:v", value: "libx264" },
      { kind: "option", name: "-preset", value: "medium" },
      { kind: "option", name: "-crf", value: "23" },
      { kind: "option", name: "-c:a", value: "aac" },
      { kind: "option", name: "-b:a", value: "128k" },
      { kind: "option", name: "-movflags", value: "+faststart" },
      { kind: "value", name: "out/web.mp4" },
    ]);
    expect(renderCommand(step.tool, args)).toEqual([
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
    ]);
    expect(args.map(renderArg)).toEqual([
      "-hide_banner",
      "-i out/source.mkv",
      "-c:v libx264",
      "-preset medium",
      "-crf 23",
      "-c:a aac",
      "-b:a 128k",
      "-movflags +faststart",
      "out/web.mp4",
    ]);
    expect(commandLine(step, args)).toBe(
      "ffmpeg -hide_banner -i out/source.mkv -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 128k -movflags +faststart out/web.mp4",
    );
  });

  it("leaves both golden steps safe", () => {
    expect(adapterFor("yt-dlp").requiresUnsafe(fixtureStep("download"))).toBe(false);
    expect(adapterFor("ffmpeg").requiresUnsafe(fixtureStep("transcode"))).toBe(false);
  });

  it("uses each step verification spec", () => {
    expect(adapterFor("yt-dlp").defaultVerify(fixtureStep("download"))).toEqual({
      exists: ["{{outputPath}}/source.mkv"],
    });
    expect(adapterFor("ffmpeg").defaultVerify(fixtureStep("transcode"))).toEqual({
      exists: ["{{outputPath}}/web.mp4"],
    });
  });
});

describe("download-transcode unbound placeholders", () => {
  it("reports every unbound download name once", () => {
    const { step, args, findings } = resolve("download", {});

    expect(findings).toEqual([
      {
        severity: "error",
        code: "E_UNBOUND_VAR",
        message: 'variable "outputPath" has no value',
        location: "step:download",
        fix: "define vars.outputPath",
      },
      {
        severity: "error",
        code: "E_UNBOUND_VAR",
        message: 'variable "sourceUrl" has no value',
        location: "step:download",
        fix: "define vars.sourceUrl",
      },
    ]);
    expect(renderCommand(step.tool, args)).toEqual([
      "yt-dlp",
      "-f",
      "bv*+ba/b",
      "--merge-output-format",
      "mkv",
      "-o",
      "{{outputPath}}/source.%(ext)s",
      "--no-playlist",
      "{{sourceUrl}}",
    ]);
  });

  it("reports one unbound transcode name across args", () => {
    const { step, args, findings } = resolve("transcode", {});

    expect(findings).toEqual([
      {
        severity: "error",
        code: "E_UNBOUND_VAR",
        message: 'variable "outputPath" has no value',
        location: "step:transcode",
        fix: "define vars.outputPath",
      },
    ]);
    expect(renderCommand(step.tool, args)).toEqual([
      "ffmpeg",
      "-hide_banner",
      "-i",
      "{{outputPath}}/source.mkv",
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
      "{{outputPath}}/web.mp4",
    ]);
  });
});

describe("download-transcode unsafe steps", () => {
  it("rejects yt-dlp exec flags and dash output", () => {
    const exec = variant("download", [
      ...fixtureStep("download").args,
      { kind: "option", name: "--exec", value: "rm {}" },
    ]);
    const dash = variant("download", [
      { kind: "option", name: "-o", value: "-" },
      { kind: "value", name: "{{sourceUrl}}" },
    ]);

    expect(adapterFor("yt-dlp").requiresUnsafe(exec)).toBe(true);
    expect(adapterFor("yt-dlp").requiresUnsafe(dash)).toBe(true);
  });

  it("rejects ffmpeg stream formats and manifests", () => {
    const hls = variant("transcode", [{ kind: "option", name: "-f", value: "hls" }]);
    const manifest = variant("transcode", [{ kind: "value", name: "out/playlist.m3u8" }]);
    const explicit = variant("transcode", [], true);

    expect(adapterFor("ffmpeg").requiresUnsafe(hls)).toBe(true);
    expect(adapterFor("ffmpeg").requiresUnsafe(manifest)).toBe(true);
    expect(adapterFor("ffmpeg").requiresUnsafe(explicit)).toBe(true);
  });
});
