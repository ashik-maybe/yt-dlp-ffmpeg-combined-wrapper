import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { NAME, VERSION } from "../../src/cli/version.js";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const ENTRY = join(ROOT, "bin/combined-wrapper.ts");
const BUN = "bun" in process.versions ? process.execPath : "bun";

function runCli(args: readonly string[]) {
  return spawnSync(BUN, [ENTRY, ...args], {
    cwd: ROOT,
    encoding: "utf8",
  });
}

describe("CLI process exits", () => {
  it("prints the version and exits 0", () => {
    const run = runCli(["--version"]);
    expect(run.status).toBe(0);
    expect(run.stdout.trim()).toBe(`${NAME} ${VERSION}`);
    expect(run.stderr).toBe("");
  });

  it("prints usage and exits 0", () => {
    const run = runCli(["--help"]);
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("Usage: combined-wrapper");
    expect(run.stderr).toBe("");
  });

  it("exits 2 when --run has no plan", () => {
    const run = runCli(["--run"]);
    expect(run.status).toBe(2);
    expect(run.stderr).toContain("--run requires --plan");
  });

  it("exits 2 on an unknown flag", () => {
    const run = runCli(["--bogus"]);
    expect(run.status).toBe(2);
    expect(run.stderr).toContain("unknown flag: --bogus");
  });

  it("exits 2 on a positional argument", () => {
    const run = runCli(["plan.json"]);
    expect(run.status).toBe(2);
    expect(run.stderr).toContain("unexpected argument: plan.json");
  });
});
