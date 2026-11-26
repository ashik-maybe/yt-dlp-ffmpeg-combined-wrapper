import { describe, expect, it } from "vitest";
import { checkBlocked, checkOverwrite, checkUnsafe, collectGuards } from "../../src/core/guards.js";
import type { PipelinePlan, Step } from "../../src/core/types.js";

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

const cleanStep: Step = {
  id: "clean",
  tool: "ffmpeg",
  args: [{ kind: "flag", name: "-hide_banner" }],
  outputs: ["out.mp4"],
};

const blockedPlan: PipelinePlan = {
  version: 1,
  id: "p2",
  name: "blocked plan",
  shell: "posix",
  steps: [
    {
      id: "download",
      tool: "yt-dlp",
      args: [{ kind: "value", name: "{{sourceUrl}}" }],
      outputs: ["<outputPath>/source.mkv"],
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

describe("checkBlocked", () => {
  it("allows a step without placeholders", () => {
    expect(checkBlocked(cleanStep)).toEqual([]);
  });

  it("blocks a brace placeholder in an argument", () => {
    const step: Step = {
      id: "download",
      tool: "yt-dlp",
      args: [{ kind: "value", name: "{{sourceUrl}}" }],
    };
    const findings = checkBlocked(step);

    expect(findings).toHaveLength(1);
    expect(findings[0].code).toBe("E_BLOCKED");
    expect(findings[0].severity).toBe("error");
    expect(findings[0].location).toBe("step:download");
    expect(findings[0].message).toContain("{{sourceUrl}}");
  });

  it("blocks an angle placeholder in an output", () => {
    const step: Step = {
      id: "transcode",
      tool: "ffmpeg",
      args: [],
      outputs: ["<outputPath>/web.mp4"],
    };
    const findings = checkBlocked(step);

    expect(findings).toHaveLength(1);
    expect(findings[0].code).toBe("E_BLOCKED");
    expect(findings[0].message).toContain("{{outputPath}}");
  });

  it("blocks placeholders in values, aliases, and argument names", () => {
    const step: Step = {
      id: "mixed",
      tool: "ffmpeg",
      args: [
        { kind: "option", name: "{{flag}}", values: ["{{one}}", "{{two}}"] },
        { kind: "option", name: "-i", value: "{{input}}", alias: "{{alias}}" },
      ],
    };
    const findings = checkBlocked(step);

    expect(findings).toHaveLength(1);
    expect(findings[0].code).toBe("E_BLOCKED");
    for (const name of ["flag", "one", "two", "input", "alias"]) {
      expect(findings[0].message).toContain(`{{${name}}}`);
    }
  });

  it("reports each placeholder name once", () => {
    const step: Step = {
      id: "repeat",
      tool: "yt-dlp",
      args: [
        { kind: "value", name: "{{url}}" },
        { kind: "value", name: "{{url}}" },
      ],
      outputs: ["<url>"],
    };
    const findings = checkBlocked(step);

    expect(findings).toHaveLength(1);
    expect(findings[0].message.match(/\{\{url\}\}/g)).toHaveLength(1);
  });
});

describe("collectGuards with vars", () => {
  it("binds vars before it checks placeholders", () => {
    const filled: PipelinePlan = {
      version: 1,
      id: "filled",
      name: "filled plan",
      shell: "posix",
      vars: { sourceUrl: "https://example.com/video", outputPath: "out" },
      steps: [
        {
          id: "download",
          tool: "yt-dlp",
          args: [{ kind: "value", name: "{{sourceUrl}}" }],
          outputs: ["{{outputPath}}/source.mkv"],
        },
      ],
    };

    expect(collectGuards(filled, { force: true, unsafe: true })).toEqual([]);
  });

  it("scans inputs and verify fields for placeholders", () => {
    const step: Step = {
      id: "verify",
      tool: "ffmpeg",
      args: [],
      inputs: ["{{inputPath}}"],
      verify: { command: "ffprobe {{probePath}}", exists: ["{{outputPath}}"] },
    };

    const names = checkBlocked(step)[0]?.message ?? "";
    expect(names).toContain("{{inputPath}}");
    expect(names).toContain("{{probePath}}");
    expect(names).toContain("{{outputPath}}");
  });
});

describe("collectGuards blocked", () => {
  it("adds E_BLOCKED for a plan with placeholders", () => {
    const findings = collectGuards(blockedPlan, { force: true, unsafe: true });

    expect(findings.some((f) => f.code === "E_BLOCKED")).toBe(true);
    expect(findings).toHaveLength(1);
  });

  it("keeps E_BLOCKED when force and unsafe are true", () => {
    const findings = collectGuards(blockedPlan, { force: true, unsafe: true });

    expect(findings.map((f) => f.code)).toEqual(["E_BLOCKED"]);
  });
});
