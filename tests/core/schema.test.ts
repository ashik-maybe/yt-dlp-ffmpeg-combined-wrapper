import { describe, expect, it } from "vitest";
import { validatePlan } from "../../src/core/schema.js";

const basePlan = {
  version: 1,
  id: "plan-1",
  name: "Test plan",
  shell: "posix",
  steps: [
    {
      id: "download",
      tool: "yt-dlp",
      args: [{ kind: "value", name: "url", value: "https://example.com" }],
    },
  ],
};

describe("validatePlan", () => {
  it("accepts a valid plan", () => {
    const result = validatePlan(basePlan);
    expect(result.ok).toBe(true);
    expect(result.plan?.id).toBe("plan-1");
    expect(result.findings).toEqual([]);
  });

  it("rejects unknown version", () => {
    const result = validatePlan({ ...basePlan, version: 2 });
    expect(result.ok).toBe(false);
    expect(result.findings.some((f) => f.code === "E_UNKNOWN_VERSION")).toBe(true);
  });

  it("rejects unknown tool", () => {
    const result = validatePlan({
      ...basePlan,
      steps: [{ id: "s1", tool: "curl", args: [] }],
    });
    expect(result.ok).toBe(false);
    expect(result.findings.some((f) => f.code === "E_UNKNOWN_TOOL")).toBe(true);
  });

  it("rejects duplicate step ids", () => {
    const result = validatePlan({
      ...basePlan,
      steps: [
        { id: "s1", tool: "yt-dlp", args: [] },
        { id: "s1", tool: "ffmpeg", args: [] },
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.findings.some((f) => f.code === "E_DUPLICATE_ID")).toBe(true);
  });

  it("rejects missing ids", () => {
    const result = validatePlan({
      ...basePlan,
      id: "",
      steps: [{ id: "", tool: "yt-dlp", args: [] }],
    });
    expect(result.ok).toBe(false);
    const missing = result.findings.filter((f) => f.code === "E_MISSING_ID");
    expect(missing.length).toBeGreaterThanOrEqual(2);
  });

  it("rejects bad shapes", () => {
    const result = validatePlan({
      version: 1,
      id: "p",
      name: "n",
      shell: "bash",
      steps: "nope",
    });
    expect(result.ok).toBe(false);
    expect(result.findings.some((f) => f.code === "E_BAD_SHAPE")).toBe(true);
  });
});
