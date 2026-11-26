#!/usr/bin/env bun
import { readFile } from "node:fs/promises";
import { parseArgs, USAGE } from "../src/cli/args.js";
import type { CliFlags } from "../src/cli/args.js";
import { formatFinding, renderPlan } from "../src/cli/print.js";
import { NAME, VERSION } from "../src/cli/version.js";
import { validatePlan } from "../src/core/index.js";
import type { PipelinePlan } from "../src/core/index.js";

type LoadedPlan =
  | { readonly ok: true; readonly plan: PipelinePlan }
  | { readonly ok: false; readonly message: string };

function detailOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function loadPlan(path: string): Promise<LoadedPlan> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    return { ok: false, message: `cannot read plan "${path}": ${detailOf(error)}` };
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (error) {
    return { ok: false, message: `cannot parse plan "${path}": ${detailOf(error)}` };
  }

  const result = validatePlan(data);
  if (!result.ok || result.plan === undefined) {
    const reasons = result.findings
      .filter((finding) => finding.severity === "error")
      .map((finding) => `${finding.code}: ${finding.message}`)
      .join("; ");
    return { ok: false, message: `invalid plan "${path}": ${reasons}` };
  }

  return { ok: true, plan: result.plan };
}

async function printPlanFile(path: string): Promise<void> {
  const loaded = await loadPlan(path);
  if (!loaded.ok) {
    console.error(`${NAME}: ${loaded.message}`);
    process.exitCode = 2;
    return;
  }

  const rendered = renderPlan(loaded.plan);
  if (!rendered.ok) {
    for (const finding of rendered.findings) {
      if (finding.severity === "error") {
        console.error(`${NAME}: ${formatFinding(finding)}`);
      }
    }
    process.exitCode = 2;
    return;
  }

  for (const command of rendered.commands) {
    console.log(command);
  }
}

async function startTui(path: string, flags: CliFlags): Promise<void> {
  const loaded = await loadPlan(path);
  if (!loaded.ok) {
    console.error(`${NAME}: ${loaded.message}`);
    process.exitCode = 2;
    return;
  }

  if (!process.stdin.isTTY) {
    console.error(`${NAME}: the interactive UI needs a terminal.`);
    process.exitCode = 2;
    return;
  }

  const [{ render }, { createElement }, { App }] = await Promise.all([
    import("ink"),
    import("react"),
    import("../src/tui/app.js"),
  ]);

  render(
    createElement(App, {
      runEnabled: flags.run,
      yes: flags.yes,
      force: flags.force,
      unsafe: flags.unsafe,
      plan: loaded.plan,
    }),
  );
}

const { flags, errors, plan } = parseArgs(process.argv.slice(2));

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`${NAME}: ${error}`);
  }
  console.error(USAGE);
  process.exitCode = 2;
} else if (flags.version) {
  console.log(`${NAME} ${VERSION}`);
} else if (flags.help) {
  console.log(USAGE);
} else if (flags.print) {
  if (plan === undefined) {
    console.error(`${NAME}: --print requires --plan <path>`);
    console.error(USAGE);
    process.exitCode = 2;
  } else {
    await printPlanFile(plan);
  }
} else if (plan !== undefined) {
  await startTui(plan, flags);
} else if (flags.run) {
  console.error(`${NAME}: --run requires --plan <path>`);
  console.error(USAGE);
  process.exitCode = 2;
} else {
  console.log(`${NAME} ${VERSION}`);
  console.log("Dry-run only. Nothing runs without --run.");
  console.log(USAGE);
}
