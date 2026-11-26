import { describe, expect, it } from "vitest";

interface CheckResult {
  ok: boolean;
  missing: string[];
}

type CheckAgents = (text: string) => CheckResult;

const scriptUrl = new URL("../../scripts/agents-check.mjs", import.meta.url);

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

This repo is a webapp tested with Playwright.

## Architecture

The code lives in src/core.
`;

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
    expect(result.missing).toContain("stale: webapp");
    expect(result.missing).toContain("stale: playwright");
    expect(result.missing).not.toContain("heading: Purpose");
    expect(result.missing).not.toContain("path: src/core");
  });
});
