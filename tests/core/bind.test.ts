import { describe, expect, it } from "vitest";
import { bindText, findUnbound, normalizePlaceholders } from "../../src/core/bind.js";

describe("bind", () => {
  it("normalizes <name> placeholders to {{name}}", () => {
    expect(normalizePlaceholders("in/<file>.mp4")).toBe("in/{{file}}.mp4");
  });

  it("binds both placeholder forms", () => {
    const vars = { url: "https://example.com", out: "video.mp4" };
    expect(bindText("{{url}} -> <out>", vars)).toBe("https://example.com -> video.mp4");
  });

  it("finds unbound placeholders", () => {
    const vars = { url: "https://example.com" };
    const unbound = findUnbound("{{url}} <out> {{tmp}} <out>", vars);
    expect(unbound).toEqual(["out", "tmp"]);
  });
});
