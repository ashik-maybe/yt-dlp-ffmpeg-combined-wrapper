import { describe, expect, it } from "vitest";
import type { PlanArg, Step } from "../../../src/core/index.js";
import { ffmpegAdapter } from "../../../src/planners/ffmpeg/index.js";

function step(overrides: Partial<Step> = {}): Step {
  return {
    id: "transcode",
    tool: "ffmpeg",
    args: [],
    ...overrides,
  };
}

function unsafe(args: readonly PlanArg[]): boolean {
  return ffmpegAdapter.requiresUnsafe(step({ args }));
}

describe("ffmpeg planner binding", () => {
  it("maps recipe args and vars to bound PlanArg values", () => {
    const args: readonly PlanArg[] = [
      { kind: "option", name: "-i", value: "{{inDir}}/source.mkv" },
      { kind: "option", name: "-crf", value: "{{crf}}" },
      {
        kind: "option",
        name: "-metadata",
        values: ["title={{title}}", "artist=orbit"],
      },
      { kind: "value", name: "{{outDir}}/web.mp4" },
    ];

    const result = ffmpegAdapter.planFromStep(step({ args }), {
      inDir: "media",
      crf: "23",
      title: "Demo",
      outDir: "out",
    });

    expect(result.findings).toEqual([]);
    expect(result.args).toEqual([
      { kind: "option", name: "-i", value: "media/source.mkv" },
      { kind: "option", name: "-crf", value: "23" },
      {
        kind: "option",
        name: "-metadata",
        values: ["title=Demo", "artist=orbit"],
      },
      { kind: "value", name: "out/web.mp4" },
    ]);
  });

  it("binds aliases and keeps literal arg text", () => {
    const result = ffmpegAdapter.planFromStep(
      step({
        args: [{ kind: "option", name: "map", alias: "{{alias}}", value: "{{stream}}" }],
      }),
      { alias: "-map", stream: "0:v:0" },
    );

    expect(result.findings).toEqual([]);
    expect(result.args).toEqual([{ kind: "option", name: "map", value: "0:v:0", alias: "-map" }]);
  });

  it("reports each unbound placeholder once", () => {
    const result = ffmpegAdapter.planFromStep(
      step({
        id: "mux",
        args: [
          { kind: "option", name: "-i", value: "{{input}}/in.mkv" },
          { kind: "option", name: "-crf", value: "{{crf}}" },
          { kind: "value", name: "{{out}}/a.mp4" },
          { kind: "option", name: "-metadata", values: ["title={{out}}", "note={{out}}"] },
        ],
      }),
      { input: "media" },
    );

    expect(result.findings.map((found) => found.code)).toEqual(["E_UNBOUND_VAR", "E_UNBOUND_VAR"]);
    expect(result.findings[0]).toMatchObject({
      severity: "error",
      message: 'variable "crf" has no value',
      location: "step:mux",
      fix: "define vars.crf",
    });
    expect(result.findings[1]).toMatchObject({
      severity: "error",
      message: 'variable "out" has no value',
      location: "step:mux",
      fix: "define vars.out",
    });
    expect(result.args[2]).toEqual({ kind: "value", name: "{{out}}/a.mp4" });
  });

  it("reports a tool mismatch", () => {
    const result = ffmpegAdapter.planFromStep(
      step({ tool: "yt-dlp", args: [{ kind: "flag", name: "-hide_banner" }] }),
      {},
    );

    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]).toMatchObject({
      severity: "error",
      code: "E_TOOL_MISMATCH",
      location: "step:transcode",
    });
    expect(result.args).toEqual([{ kind: "flag", name: "-hide_banner" }]);
  });
});

describe("ffmpeg planner unsafe detection", () => {
  it("flags hls formats, options, and manifests", () => {
    expect(unsafe([{ kind: "option", name: "-f", value: "hls" }])).toBe(true);
    expect(unsafe([{ kind: "option", name: "-hls_time", value: "6" }])).toBe(true);
    expect(unsafe([{ kind: "value", name: "out/playlist.m3u8" }])).toBe(true);
  });

  it("flags dash formats, options, and manifests", () => {
    expect(unsafe([{ kind: "option", name: "-f", value: "dash" }])).toBe(true);
    expect(unsafe([{ kind: "option", name: "-dash_segment_type", value: "mp4" }])).toBe(true);
    expect(unsafe([{ kind: "value", name: "out/manifest.mpd" }])).toBe(true);
  });

  it("flags rtmp and srt urls", () => {
    expect(unsafe([{ kind: "option", name: "-i", value: "rtmp://example.com/live" }])).toBe(true);
    expect(unsafe([{ kind: "option", name: "-i", value: "rtmps://example.com/live" }])).toBe(true);
    expect(unsafe([{ kind: "value", name: "srt://example.com:9000?mode=caller" }])).toBe(true);
  });

  it("flags filter scripts", () => {
    expect(unsafe([{ kind: "option", name: "-filter_script", value: "filters.txt" }])).toBe(true);
    expect(
      unsafe([{ kind: "option", name: "-filter_complex_script:v", value: "filters.txt" }]),
    ).toBe(true);
  });

  it("leaves a plain transcode safe", () => {
    const args: readonly PlanArg[] = [
      { kind: "flag", name: "-hide_banner" },
      { kind: "option", name: "-i", value: "https://example.com/video.mp4" },
      { kind: "option", name: "-c:v", value: "libx264" },
      { kind: "option", name: "-filter_complex", value: "[0:v]scale=1280:720[v]" },
      { kind: "option", name: "-f", value: "mp4" },
      { kind: "value", name: "out/web.mp4" },
    ];

    expect(unsafe(args)).toBe(false);
  });

  it("honours the explicit unsafe flag", () => {
    expect(ffmpegAdapter.requiresUnsafe(step({ unsafe: true }))).toBe(true);
  });
});

describe("ffmpeg planner verification", () => {
  it("returns explicit verify unchanged", () => {
    const verify = { exists: ["out/web.mp4"], expectExitCode: 0 };
    expect(ffmpegAdapter.defaultVerify(step({ outputs: ["out/web.mp4"], verify }))).toBe(verify);
  });

  it("probes the first output with ffprobe", () => {
    const verify = ffmpegAdapter.defaultVerify(
      step({ outputs: ["out/web.mp4", "out/extra.mkv"] }),
    );

    expect(verify).toEqual({
      command: "ffprobe -v error -show_entries format=format_name -of csv=p=0 out/web.mp4",
      expectExitCode: 0,
    });
  });

  it("quotes output paths with spaces", () => {
    const verify = ffmpegAdapter.defaultVerify(step({ outputs: ["out/my video.mp4"] }));
    expect(verify.command).toContain("'out/my video.mp4'");
  });

  it("falls back to the exit code without outputs", () => {
    expect(ffmpegAdapter.defaultVerify(step())).toEqual({ expectExitCode: 0 });
  });
});
