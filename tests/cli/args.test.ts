import { describe, expect, it } from "vitest";
import { parseArgs } from "../../src/cli/args.js";
import type { CliFlags } from "../../src/cli/args.js";

const NO_FLAGS: CliFlags = {
  version: false,
  help: false,
  run: false,
  yes: false,
  force: false,
  unsafe: false,
};

const FLAG_CASES: readonly { readonly name: keyof CliFlags; readonly token: string }[] = [
  { name: "version", token: "--version" },
  { name: "help", token: "--help" },
  { name: "run", token: "--run" },
  { name: "yes", token: "--yes" },
  { name: "force", token: "--force" },
  { name: "unsafe", token: "--unsafe" },
];

describe("parseArgs", () => {
  it("returns no flags and no errors for empty argv", () => {
    expect(parseArgs([])).toEqual({ flags: NO_FLAGS, errors: [] });
  });

  for (const { name, token } of FLAG_CASES) {
    it(`parses ${token}`, () => {
      const { flags, errors } = parseArgs([token]);
      expect(errors).toEqual([]);
      expect(flags).toEqual({ ...NO_FLAGS, [name]: true });
    });
  }

  it("parses all flags together", () => {
    const { flags, errors } = parseArgs(FLAG_CASES.map((item) => item.token));
    expect(errors).toEqual([]);
    expect(flags).toEqual({
      version: true,
      help: true,
      run: true,
      yes: true,
      force: true,
      unsafe: true,
    });
  });

  it("rejects an unknown flag", () => {
    const { flags, errors } = parseArgs(["--bogus"]);
    expect(flags).toEqual(NO_FLAGS);
    expect(errors).toEqual(["unknown flag: --bogus"]);
  });

  it("keeps valid flags when an unknown flag is present", () => {
    const { flags, errors } = parseArgs(["--run", "-x"]);
    expect(flags).toEqual({ ...NO_FLAGS, run: true });
    expect(errors).toEqual(["unknown flag: -x"]);
  });

  it("rejects a positional argument", () => {
    const { flags, errors } = parseArgs(["plan.json"]);
    expect(flags).toEqual(NO_FLAGS);
    expect(errors).toEqual(["unexpected argument: plan.json"]);
  });
});

describe("parseArgs --plan", () => {
  it("reads a plan path from the next argument", () => {
    expect(parseArgs(["--plan", "plan.json"])).toEqual({
      flags: NO_FLAGS,
      errors: [],
      plan: "plan.json",
    });
  });

  it("reads a plan path from an equals form", () => {
    expect(parseArgs(["--plan=plan.json"])).toEqual({
      flags: NO_FLAGS,
      errors: [],
      plan: "plan.json",
    });
  });

  it("keeps other flags next to --plan", () => {
    const { flags, errors, plan } = parseArgs(["--plan", "plan.json", "--run", "--yes"]);
    expect(plan).toBe("plan.json");
    expect(errors).toEqual([]);
    expect(flags).toEqual({ ...NO_FLAGS, run: true, yes: true });
  });

  it("rejects --plan without a value", () => {
    expect(parseArgs(["--plan"])).toEqual({
      flags: NO_FLAGS,
      errors: ["missing value for --plan"],
    });
  });

  it("rejects an empty equals value", () => {
    expect(parseArgs(["--plan="])).toEqual({
      flags: NO_FLAGS,
      errors: ["missing value for --plan"],
    });
  });

  it("rejects --plan directly before another flag", () => {
    const { flags, errors, plan } = parseArgs(["--plan", "--run"]);
    expect(plan).toBeUndefined();
    expect(errors).toEqual(["missing value for --plan"]);
    expect(flags).toEqual({ ...NO_FLAGS, run: true });
  });
});
