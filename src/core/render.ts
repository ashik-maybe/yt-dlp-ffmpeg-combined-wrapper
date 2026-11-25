import type { PlanArg, Tool } from "./types.js";

export function quotePosix(value: string): string {
  if (value.length === 0) return "''";
  if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(value)) {
    return value;
  }
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function flagToken(name: string): string {
  if (name.startsWith("-")) return name;
  return name.length === 1 ? `-${name}` : `--${name}`;
}

export function renderArg(arg: PlanArg): string {
  if (arg.kind === "value") {
    return quotePosix(arg.value ?? arg.name);
  }

  const token = flagToken(arg.alias ?? arg.name);
  if (arg.kind === "flag") {
    return token;
  }

  const values =
    arg.values && arg.values.length > 0 ? arg.values : arg.value !== undefined ? [arg.value] : [];

  if (values.length === 0) {
    return token;
  }

  return values.map((v) => `${token} ${quotePosix(v)}`).join(" ");
}

export function renderCommand(tool: Tool, args: readonly PlanArg[]): readonly string[] {
  const argv: string[] = [tool];
  for (const arg of args) {
    if (arg.kind === "value") {
      argv.push(arg.value ?? arg.name);
      continue;
    }
    const token = flagToken(arg.alias ?? arg.name);
    if (arg.kind === "flag") {
      argv.push(token);
      continue;
    }
    const values =
      arg.values && arg.values.length > 0 ? arg.values : arg.value !== undefined ? [arg.value] : [];
    if (values.length === 0) {
      argv.push(token);
      continue;
    }
    for (const v of values) {
      argv.push(token, v);
    }
  }
  return argv;
}
