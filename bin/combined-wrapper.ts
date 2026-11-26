#!/usr/bin/env bun
import { parseArgs, USAGE } from "../src/cli/args.js";
import { NAME, VERSION } from "../src/cli/version.js";

const { flags, errors } = parseArgs(process.argv.slice(2));

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
} else if (flags.run) {
  console.log("Execution is not available yet. Nothing ran.");
} else {
  console.log(`${NAME} ${VERSION}`);
  console.log("Dry-run only. Nothing runs without --run.");
  console.log(USAGE);
}
