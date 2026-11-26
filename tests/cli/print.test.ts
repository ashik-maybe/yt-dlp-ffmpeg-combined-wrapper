import { spawnSync } from "node:child_process";
import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { downloadTranscodePlan } from "../../src/contracts/index.js";
import type { PipelinePlan } from "../../src/core/index.js";
import { renderPlan } from "../../src/cli/print.js";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const ENTRY = join(ROOT, "bin/combined-wrapper.ts");
const BUN = "bun" in process.versions ? process.execPath : "bun";

const DOWNLOAD_LINE =
  "yt-dlp -f 'bv*+ba/b' --merge-output-format mkv -o 'out/source.%(ext)s' --no-playlist https://example.com/video";
const TRANSCODE_LINE =
  "ffmpeg -hide_banner -i out/source.mkv -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 128k -movflags +faststart out/web.mp4";

interface CliRun {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

function runCli(args: readonly string[]): CliRun {
  const result = spawnSync(BUN, [ENTRY, ...args], {
    cwd: ROOT,
    encoding: "utf8",
  });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

function stdoutLines(stdout: string): readonly string[] {
  const trimmed = stdout.trimEnd();
  return trimmed.length === 0 ? [] : trimmed.split("\n");
}

let dir = "";

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "orbit-cli-"));
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function writePlan(name: string, plan: unknown): Promise<string> {
  const path = join(dir, name);
  await writeFile(path, JSON.stringify(plan), "utf8");
  return path;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

describe("renderPlan", () => {
  it("renders one command per step in plan order", () => {
    const rendered = renderPlan(downloadTranscodePlan());

    expect(rendered.ok).toBe(true);
    expect(rendered.findings).toEqual([]);
    expect(rendered.commands).toEqual([DOWNLOAD_LINE, TRANSCODE_LINE]);
  });

  it("reports unbound variables and keeps the placeholder text", () => {
    const plan = { ...downloadTranscodePlan(), vars: undefined };
    const rendered = renderPlan(plan);

    expect(rendered.ok).toBe(false);
    expect(rendered.findings.map((finding) => finding.code)).toEqual([
      "E_UNBOUND_VAR",
      "E_UNBOUND_VAR",
      "E_UNBOUND_VAR",
    ]);
    expect(rendered.commands).toEqual([
      "yt-dlp -f 'bv*+ba/b' --merge-output-format mkv -o '{{outputPath}}/source.%(ext)s' --no-playlist '{{sourceUrl}}'",
      "ffmpeg -hide_banner -i '{{outputPath}}/source.mkv' -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 128k -movflags +faststart '{{outputPath}}/web.mp4'",
    ]);
  });
});

describe("--print", () => {
  it("prints rendered commands to stdout and exits 0", async () => {
    const path = await writePlan("valid.json", downloadTranscodePlan());

    const run = runCli(["--print", "--plan", path]);

    expect(run.status).toBe(0);
    expect(stdoutLines(run.stdout)).toEqual([DOWNLOAD_LINE, TRANSCODE_LINE]);
    expect(run.stderr).toBe("");
  });

  it("exits 2 without --plan and prints a clear error", () => {
    const run = runCli(["--print"]);

    expect(run.status).toBe(2);
    expect(run.stdout).toBe("");
    expect(run.stderr).toContain("combined-wrapper: --print requires --plan <path>");
  });

  it("exits 2 on an invalid plan", async () => {
    const path = await writePlan("invalid.json", { version: 2, steps: [] });

    const run = runCli(["--print", "--plan", path]);

    expect(run.status).toBe(2);
    expect(run.stdout).toBe("");
    expect(run.stderr).toContain("invalid plan");
  });

  it("does not spawn a process for an unsafe exec step", async () => {
    const marker = join(dir, "spawned");
    const plan: PipelinePlan = {
      version: 1,
      id: "no-spawn",
      name: "No spawn",
      shell: "posix",
      steps: [
        {
          id: "download",
          tool: "yt-dlp",
          args: [
            { kind: "option", name: "--exec", value: `touch ${marker}` },
            { kind: "value", name: "https://example.com/video" },
          ],
        },
      ],
    };
    const path = await writePlan("no-spawn.json", plan);

    const run = runCli(["--print", "--run", "--plan", path]);

    expect(run.status).toBe(0);
    expect(run.stdout).toContain("--exec");
    expect(await fileExists(marker)).toBe(false);
  });
});
