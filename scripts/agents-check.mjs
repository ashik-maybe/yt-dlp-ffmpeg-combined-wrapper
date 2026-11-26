import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const AGENTS_URL = process.env.AGENTS_FILE
  ? pathToFileURL(path.resolve(process.env.AGENTS_FILE))
  : new URL("../AGENTS.md", import.meta.url);

export const REQUIRED_HEADINGS = [
  "Purpose",
  "Start here",
  "Verify",
  "Architecture",
  "Invariants",
  "Add a recipe",
  "Add a plan",
  "TUI rules",
  "Pipelines",
  "Pitfalls",
  "Ownership",
  "Commits",
];

export const REQUIRED_COMMANDS = [
  "bun install --frozen-lockfile",
  "bun run ci",
  "bun run tui:test",
  "bun run spec:check",
  "bun run readme:check",
  "bash scripts/package-tui.sh",
];

export const REQUIRED_PATHS = ["src/core", "src/planners", "src/runner", "src/tui", "OWNERS.md"];

export const REQUIRED_WORDS = ["dry-run", "--run", "--force", "--unsafe"];

export const STALE_TERMS = [/web\s*app/i, /playwright/i];

function stripFences(text) {
  const lines = text.split(/\r?\n/);
  const kept = [];
  let fence = null;
  for (const line of lines) {
    const match = /^\s*(```|~~~)/.exec(line);
    if (match !== null) {
      const marker = match[1];
      if (fence === null) fence = marker;
      else if (fence === marker) fence = null;
      continue;
    }
    if (fence === null) kept.push(line);
  }
  return kept.join("\n");
}

function headingTitles(text) {
  const titles = new Set();
  for (const line of stripFences(text).split(/\r?\n/)) {
    const match = /^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/.exec(line);
    if (match === null) continue;
    titles.add(match[1].replace(/\s+/g, " ").trim().toLowerCase());
  }
  return titles;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasTerm(text, term) {
  const pattern = new RegExp(
    `(?:^|[^A-Za-z0-9_-])${escapeRegExp(term)}(?![A-Za-z0-9_-])(?![.:][A-Za-z0-9_])`,
    "m",
  );
  return pattern.test(text);
}

export function checkAgents(text) {
  const source = typeof text === "string" ? text : "";
  const headings = headingTitles(source);
  const missing = [];

  for (const heading of REQUIRED_HEADINGS) {
    if (!headings.has(heading.toLowerCase())) missing.push(`heading: ${heading}`);
  }
  for (const command of REQUIRED_COMMANDS) {
    if (!hasTerm(source, command)) missing.push(`command: ${command}`);
  }
  for (const requiredPath of REQUIRED_PATHS) {
    if (!hasTerm(source, requiredPath)) missing.push(`path: ${requiredPath}`);
  }
  for (const word of REQUIRED_WORDS) {
    if (!hasTerm(source, word)) missing.push(`word: ${word}`);
  }
  for (const term of STALE_TERMS) {
    if (term.test(source)) missing.push(`found stale: ${term.source}`);
  }

  return { ok: missing.length === 0, missing };
}

export function main() {
  let text;
  try {
    text = readFileSync(AGENTS_URL, "utf8");
  } catch (error) {
    console.error(`agents-check: cannot read AGENTS.md: ${error.message}`);
    process.exitCode = 1;
    return 1;
  }

  const { ok, missing } = checkAgents(text);
  console.log(
    `agents-check: ${REQUIRED_HEADINGS.length} headings, ${REQUIRED_COMMANDS.length} commands, ` +
      `${REQUIRED_PATHS.length} paths, ${REQUIRED_WORDS.length} words, ` +
      `${STALE_TERMS.length} stale patterns`,
  );

  if (!ok) {
    for (const item of missing) {
      const label = item.startsWith("found stale:") ? "" : "missing: ";
      console.error(`  FAIL ${label}${item}`);
    }
    console.error(`agents-check: failed (${missing.length} problems)`);
    process.exitCode = 1;
    return 1;
  }

  console.log("agents-check: PASS");
  process.exitCode = 0;
  return 0;
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) {
  main();
}
