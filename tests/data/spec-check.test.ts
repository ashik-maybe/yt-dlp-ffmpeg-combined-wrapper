import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

interface CheckError {
  code: string;
  file?: string;
  message: string;
}

interface CheckResult {
  ok: boolean;
  files: string[];
  recipeCount: number;
  counts: Record<string, number>;
  errors: CheckError[];
}

type CheckSpecs = (roots?: string[]) => Promise<CheckResult>;

const scriptUrl = new URL("../../scripts/spec-check.mjs", import.meta.url);
const scriptPath = fileURLToPath(scriptUrl);

let checkSpecs: CheckSpecs;
let workDir: string;

beforeEach(async () => {
  const module = (await import(scriptUrl.href)) as { checkSpecs: CheckSpecs };
  checkSpecs = module.checkSpecs;
  workDir = await mkdtemp(path.join(tmpdir(), "spec-check-"));
});

afterEach(async () => {
  await rm(workDir, { recursive: true, force: true });
});

async function writeJson(relative: string, value: unknown): Promise<string> {
  const full = path.join(workDir, relative);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, JSON.stringify(value, null, 2), "utf8");
  return full;
}

describe("checkSpecs", () => {
  it("reads recipes from data and spec roots", async () => {
    await writeJson("data/ffmpeg.json", [
      { id: "ff-1", name: "Scale", tool: "ffmpeg", args: [] },
      { id: "ff-2", name: "Trim", tool: "ffmpeg", args: [] },
    ]);
    await writeJson("spec/yt-dlp.json", {
      recipes: [{ id: "yt-1", name: "Audio", tool: "yt-dlp", args: [] }],
    });
    await writeJson("spec/nested/single.json", {
      id: "yt-2",
      name: "Video",
      tool: "yt-dlp",
      args: [],
    });
    await writeFile(path.join(workDir, "data", "notes.txt"), "ignored", "utf8");

    const result = await checkSpecs([path.join(workDir, "data"), path.join(workDir, "spec")]);

    expect(result.ok).toBe(true);
    expect(result.files).toHaveLength(3);
    expect(result.recipeCount).toBe(4);
    expect(result.counts).toEqual({ ffmpeg: 2, "yt-dlp": 2 });
    expect(result.errors).toEqual([]);
  });

  it("reports invalid JSON", async () => {
    const badFile = path.join(workDir, "data", "bad.json");
    await mkdir(path.dirname(badFile), { recursive: true });
    await writeFile(badFile, "{ not json", "utf8");

    const result = await checkSpecs([path.join(workDir, "data")]);

    expect(result.ok).toBe(false);
    expect(result.recipeCount).toBe(0);
    expect(result.counts).toEqual({});
    const error = result.errors.find((item) => item.code === "E_INVALID_JSON");
    expect(error).toBeDefined();
    expect(error?.file).toBe(badFile);
  });

  it("reports duplicate recipe ids across files", async () => {
    const first = await writeJson("data/first.json", [
      { id: "dup", name: "One", tool: "ffmpeg", args: [] },
    ]);
    const second = await writeJson("spec/second.json", [
      { id: "dup", name: "Two", tool: "yt-dlp", args: [] },
    ]);

    const result = await checkSpecs([path.join(workDir, "data"), path.join(workDir, "spec")]);

    expect(result.ok).toBe(false);
    expect(result.recipeCount).toBe(2);
    expect(result.counts).toEqual({ ffmpeg: 1, "yt-dlp": 1 });
    const duplicates = result.errors.filter((item) => item.code === "E_DUPLICATE_ID");
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0]?.message).toContain("dup");
    expect(duplicates[0]?.message).toContain(first);
    expect(duplicates[0]?.message).toContain(second);
  });

  it("ignores catalog groups and reads their nested items", async () => {
    await writeJson("data/catalog.json", {
      picker: {
        id: "picker",
        items: [{ id: "ff-1", name: "Scale", tool: "ffmpeg", args: [] }],
      },
      more: {
        id: "more",
        items: [
          { id: "ff-2", name: "Trim", tool: "ffmpeg", args: [] },
          { id: "yt-1", name: "Audio", tool: "yt-dlp", args: [] },
        ],
      },
    });

    const result = await checkSpecs([path.join(workDir, "data")]);

    expect(result.ok).toBe(true);
    expect(result.recipeCount).toBe(3);
    expect(result.counts).toEqual({ ffmpeg: 2, "yt-dlp": 1 });
    expect(result.counts.unknown).toBeUndefined();
  });

  it("ignores roots that do not exist", async () => {
    const result = await checkSpecs([path.join(workDir, "absent")]);

    expect(result.ok).toBe(true);
    expect(result.files).toEqual([]);
    expect(result.recipeCount).toBe(0);
  });
});

describe("spec-check CLI", () => {
  it("exits 0 and prints counts by tool", async () => {
    await writeJson("data/ffmpeg.json", [{ id: "ff-1", name: "Scale", tool: "ffmpeg", args: [] }]);
    await writeJson("spec/yt-dlp.json", [{ id: "yt-1", name: "Audio", tool: "yt-dlp", args: [] }]);

    const run = spawnSync(
      process.execPath,
      [scriptPath, path.join(workDir, "data"), path.join(workDir, "spec")],
      { encoding: "utf8" },
    );

    expect(run.status).toBe(0);
    expect(run.stdout).toContain("ffmpeg: 1");
    expect(run.stdout).toContain("yt-dlp: 1");
    expect(run.stdout).toContain("spec-check: ok");
  });

  it("exits 1 on invalid JSON", async () => {
    const badFile = path.join(workDir, "data", "bad.json");
    await mkdir(path.dirname(badFile), { recursive: true });
    await writeFile(badFile, "{ not json", "utf8");

    const run = spawnSync(process.execPath, [scriptPath, path.join(workDir, "data")], {
      encoding: "utf8",
    });

    expect(run.status).toBe(1);
    expect(run.stderr).toContain("invalid JSON");
    expect(run.stderr).toContain("spec-check: failed");
  });

  it("exits 1 on duplicate recipe ids", async () => {
    await writeJson("data/first.json", [{ id: "dup", name: "One", tool: "ffmpeg", args: [] }]);
    await writeJson("data/second.json", [{ id: "dup", name: "Two", tool: "ffmpeg", args: [] }]);

    const run = spawnSync(process.execPath, [scriptPath, path.join(workDir, "data")], {
      encoding: "utf8",
    });

    expect(run.status).toBe(1);
    expect(run.stderr).toContain('duplicate recipe id "dup"');
  });
});
