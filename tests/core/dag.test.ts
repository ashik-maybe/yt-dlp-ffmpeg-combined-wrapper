import { describe, expect, it } from "vitest";
import { topoOrder, validateDag } from "../../src/core/dag.js";
import type { Step } from "../../src/core/types.js";

const steps: Step[] = [
  { id: "a", tool: "yt-dlp", args: [] },
  { id: "b", tool: "ffmpeg", args: [], dependsOn: ["a"] },
  { id: "c", tool: "ffmpeg", args: [], dependsOn: ["b"] },
];

describe("dag", () => {
  it("returns topo order for an acyclic graph", () => {
    const result = topoOrder(steps);
    expect(result.ok).toBe(true);
    expect(result.order).toEqual(["a", "b", "c"]);
    expect(result.findings).toEqual([]);
  });

  it("detects cycles", () => {
    const cyclic: Step[] = [
      { id: "a", tool: "yt-dlp", args: [], dependsOn: ["c"] },
      { id: "b", tool: "ffmpeg", args: [], dependsOn: ["a"] },
      { id: "c", tool: "ffmpeg", args: [], dependsOn: ["b"] },
    ];
    const result = validateDag(cyclic);
    expect(result.ok).toBe(false);
    expect(result.findings.some((f) => f.code === "E_CYCLE")).toBe(true);
  });

  it("detects missing dependency ids", () => {
    const missing: Step[] = [{ id: "a", tool: "yt-dlp", args: [], dependsOn: ["ghost"] }];
    const result = validateDag(missing);
    expect(result.ok).toBe(false);
    expect(result.findings.some((f) => f.code === "E_MISSING_DEP")).toBe(true);
    expect(result.findings[0].message).toContain("ghost");
  });
});
