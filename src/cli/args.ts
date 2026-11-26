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
  readonly errors: readonly string[];
}

export const USAGE = `Usage: ${NAME} [options]

Plan and review yt-dlp and ffmpeg commands.

Options:
  --run       Allow command execution. Off by default.
  --yes       Skip the confirmation prompt before execution.
  --force     Allow overwrite of an existing output file.
  --unsafe    Allow unsafe recipes and unsafe raw flags.
  --help      Print this usage and exit.
  --version   Print name and version and exit.`;

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

  for (const arg of argv) {
    if (!arg.startsWith("-")) {
      errors.push(`unexpected argument: ${arg}`);
      continue;
    }

    const name = arg.slice(2);
    if (!arg.startsWith("--") || !FLAGS.has(name)) {
      errors.push(`unknown flag: ${arg}`);
      continue;
    }

    flags[name as keyof CliFlags] = true;
  }

  return { flags, errors };
}
