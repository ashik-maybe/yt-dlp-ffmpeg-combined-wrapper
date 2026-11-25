import { describe, expect, it } from "vitest";
import { checkOverwrite, checkUnsafe, collectGuards } from "../../src/core/guards.js";
import type { PipelinePlan } from "../../src/core/types.js";

const plan: PipelinePlan = {
  version: 1,
  id: "p1",
  name: "plan",
  shell: "posix",
  steps: [
    {
      id: "s1",
      tool: "ffmpeg",
      args: [],
      outputs: ["out.mp4"],
      unsafe: true,
    },
  ],
};

describe("guards", () => {
  it("reports overwrite when force is false", () => {
    const findings = checkOverwrite("out.mp4", false);
    expect(findings).toHaveLength(1);
    expect(findings[0].code).toBe("E_OVERWRITE");
  });

  it("allows overwrite when force is true", () => {
    expect(checkOverwrite("out.mp4", true)).toEqual([]);
  });

  it("reports unsafe steps without unsafe mode", () => {
    const findings = checkUnsafe(plan.steps[0], false);
    expect(findings).toHaveLength(1);
    expect(findings[0].code).toBe("E_UNSAFE");
  });

  it("collects guards from a plan", () => {
    const findings = collectGuards(plan, { force: false, unsafe: false });
    expect(findings.some((f) => f.code === "E_UNSAFE")).toBe(true);
    expect(findings.some((f) => f.code === "E_OVERWRITE")).toBe(true);

    const allowed = collectGuards(plan, { force: true, unsafe: true });
    expect(allowed).toEqual([]);
  });
});
