import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

interface CheckResult {
  ok: boolean;
  missing: string[];
}

type CheckAgents = (text: string) => CheckResult;

const scriptUrl = new URL("../../scripts/agents-check.mjs", import.meta.url);
const scriptPath = fileURLToPath(scriptUrl);

async function loadCheckAgents(): Promise<CheckAgents> {
  const module = (await import(scriptUrl.href)) as { checkAgents: CheckAgents };
  return module.checkAgents;
}

const COMPLETE = `# AGENTS

## Purpose

Explain the repo in one page.

## Start here

Read OWNERS.md before you change code.

## Verify

Run these commands:

\`\`\`sh
bun install --frozen-lockfile
bun run ci
bun run tui:test
bun run spec:check
bun run readme:check
bash scripts/package-tui.sh
\`\`\`

## Architecture

The code lives in src/core, src/planners, src/runner, and src/tui.

## Invariants

The first pass is a dry-run.
\`--run\` runs the plan.
\`--force\` skips a check.
\`--unsafe\` permits an unsafe plan.

## Add a recipe

Add JSON to src/data.

## Add a plan

Add JSON to examples/plans.

## TUI rules

Keep screens small.

## Pipelines

Read a plan, render commands, then run them.

## Pitfalls

Do not skip the dry-run.

## Ownership

See OWNERS.md.

## Commits

Use one short subject line.
`;

const FAILING = `# AGENTS

## Purpose

This repo is a web app tested with Playwright.

## Architecture

The code lives in src/core.
`;

let dir = "";

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "agents-check-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

function runScript(file: string | undefined) {
  return spawnSync(process.execPath, [scriptPath], {
    encoding: "utf8",
    env: { ...process.env, AGENTS_FILE: file ?? "" },
  });
}

describe("checkAgents", () => {
  it("accepts a complete AGENTS.md", async () => {
    const checkAgents = await loadCheckAgents();

    const result = checkAgents(COMPLETE);

    expect(result.missing).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("reports missing items in a failing AGENTS.md", async () => {
    const checkAgents = await loadCheckAgents();

    const result = checkAgents(FAILING);

    expect(result.ok).toBe(false);
    expect(result.missing).toContain("heading: Start here");
    expect(result.missing).toContain("heading: Verify");
    expect(result.missing).toContain("heading: Commits");
    expect(result.missing).toContain("command: bun install --frozen-lockfile");
    expect(result.missing).toContain("command: bun run ci");
    expect(result.missing).toContain("path: src/planners");
    expect(result.missing).toContain("path: OWNERS.md");
    expect(result.missing).toContain("word: dry-run");
    expect(result.missing).toContain("word: --unsafe");
    expect(result.missing).toContain("found stale: web\\s*app");
    expect(result.missing).toContain("found stale: playwright");
    expect(result.missing).not.toContain("heading: Purpose");
    expect(result.missing).not.toContain("path: src/core");
  });

  it("does not accept longer tokens as matches", async () => {
    const checkAgents = await loadCheckAgents();
    const text = COMPLETE.replace("--run", "--runaway")
      .replace("--force", "--forced")
      .replace("src/runner", "src/runner2");

    const result = checkAgents(text);

    expect(result.missing).toContain("word: --run");
    expect(result.missing).toContain("word: --force");
    expect(result.missing).toContain("path: src/runner");
  });

  it("does not count a heading inside a code fence", async () => {
    const checkAgents = await loadCheckAgents();
    const text = COMPLETE.replace("## Purpose", "```\n## Purpose\n```");

    const result = checkAgents(text);

    expect(result.missing).toContain("heading: Purpose");
  });
});

describe("agents-check process", () => {
  it("exits 0 for a complete file", async () => {
    const file = join(dir, "AGENTS.md");
    await writeFile(file, COMPLETE, "utf8");

    const run = runScript(file);

    expect(run.status).toBe(0);
    expect(run.stdout).toContain("agents-check: PASS");
  });

  it("exits 1 for a failing file", async () => {
    const file = join(dir, "AGENTS.md");
    await writeFile(file, FAILING, "utf8");

    const run = runScript(file);

    expect(run.status).toBe(1);
    expect(run.stderr).toContain("agents-check: failed");
  });

  it("exits 1 when the file is missing", () => {
    const run = runScript(join(dir, "absent.md"));

    expect(run.status).toBe(1);
    expect(run.stderr).toContain("cannot read AGENTS.md");
  });
});
