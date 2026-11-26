import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const AGENTS_URL = new URL("../AGENTS.md", import.meta.url);

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

export const STALE_TERMS = ["webapp", "playwright"];

function headingTitles(text) {
  const titles = new Set();
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/.exec(line);
    if (match === null) continue;
    titles.add(match[1].replace(/\s+/g, " ").trim().toLowerCase());
  }
  return titles;
}

export function checkAgents(text) {
  const source = typeof text === "string" ? text : "";
  const lower = source.toLowerCase();
  const headings = headingTitles(source);
  const missing = [];

  for (const heading of REQUIRED_HEADINGS) {
    if (!headings.has(heading.toLowerCase())) missing.push(`heading: ${heading}`);
  }
  for (const command of REQUIRED_COMMANDS) {
    if (!source.includes(command)) missing.push(`command: ${command}`);
  }
  for (const requiredPath of REQUIRED_PATHS) {
    if (!source.includes(requiredPath)) missing.push(`path: ${requiredPath}`);
  }
  for (const word of REQUIRED_WORDS) {
    if (!source.includes(word)) missing.push(`word: ${word}`);
  }
  for (const term of STALE_TERMS) {
    if (lower.includes(term)) missing.push(`stale: ${term}`);
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
      `${STALE_TERMS.length} stale terms`,
  );

  if (!ok) {
    for (const item of missing) console.error(`  FAIL missing: ${item}`);
    console.error(`agents-check: failed (${missing.length} missing)`);
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
