import { NAME } from "./version.js";

export interface CliFlags {
  readonly version: boolean;
  readonly help: boolean;
  readonly run: boolean;
  readonly yes: boolean;
  readonly force: boolean;
  readonly unsafe: boolean;
}

export interface ParsedArgs {
  readonly flags: CliFlags;
  readonly plan?: string;
  readonly errors: readonly string[];
}

export const USAGE = `Usage: ${NAME} [options]

Plan and review yt-dlp and ffmpeg commands.

Options:
  --plan <path>  Read a plan JSON file.
  --run          Allow command execution. Off by default.
  --yes          Skip the confirmation prompt before execution.
  --force        Allow overwrite of an existing output file.
  --unsafe       Allow unsafe recipes and unsafe raw flags.
  --help         Print this usage and exit.
  --version      Print name and version and exit.`;

const FLAG_NAMES = [
  "version",
  "help",
  "run",
  "yes",
  "force",
  "unsafe",
] as const satisfies readonly (keyof CliFlags)[];

const FLAGS = new Set<string>(FLAG_NAMES);

export function parseArgs(argv: readonly string[]): ParsedArgs {
  const flags: Record<keyof CliFlags, boolean> = {
    version: false,
    help: false,
    run: false,
    yes: false,
    force: false,
    unsafe: false,
  };
  const errors: string[] = [];
  let planPath: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (!arg.startsWith("-")) {
      errors.push(`unexpected argument: ${arg}`);
      continue;
    }

    if (!arg.startsWith("--")) {
      errors.push(`unknown flag: ${arg}`);
      continue;
    }

    const body = arg.slice(2);
    const equals = body.indexOf("=");
    const name = equals === -1 ? body : body.slice(0, equals);
    const inline = equals === -1 ? undefined : body.slice(equals + 1);

    if (name === "plan") {
      if (inline !== undefined) {
        if (inline === "") {
          errors.push("missing value for --plan");
        } else {
          planPath = inline;
        }
        continue;
      }

      const next = argv[index + 1];
      if (next === undefined || next.startsWith("-")) {
        errors.push("missing value for --plan");
        continue;
      }
      planPath = next;
      index += 1;
      continue;
    }

    if (inline !== undefined || !FLAGS.has(name)) {
      errors.push(`unknown flag: ${arg}`);
      continue;
    }

    flags[name as keyof CliFlags] = true;
  }

  return planPath === undefined ? { flags, errors } : { flags, errors, plan: planPath };
}
