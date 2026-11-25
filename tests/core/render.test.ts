import { describe, expect, it } from "vitest";
import { renderArg, renderCommand } from "../../src/core/render.js";

describe("render", () => {
  it("renders flag, option, and value args", () => {
    expect(renderArg({ kind: "flag", name: "verbose" })).toBe("--verbose");
    expect(renderArg({ kind: "option", name: "output", value: "out.mp4" })).toBe(
      "--output out.mp4",
    );
    expect(renderArg({ kind: "value", name: "url", value: "https://example.com" })).toBe(
      "https://example.com",
    );
  });

  it("applies POSIX quoting for unsafe values", () => {
    expect(renderArg({ kind: "option", name: "title", value: "hello world" })).toBe(
      "--title 'hello world'",
    );
    expect(renderArg({ kind: "value", name: "v", value: "it's" })).toBe("'it'\\''s'");
  });

  it("renders argv-safe command output", () => {
    const argv = renderCommand("ffmpeg", [
      { kind: "flag", name: "y" },
      { kind: "option", name: "i", value: "in file.mp4" },
      { kind: "option", name: "vf", value: "scale=1280:720" },
      { kind: "value", name: "out", value: "out file.mp4" },
    ]);

    expect(argv).toEqual([
      "ffmpeg",
      "-y",
      "-i",
      "in file.mp4",
      "--vf",
      "scale=1280:720",
      "out file.mp4",
    ]);
  });
});
