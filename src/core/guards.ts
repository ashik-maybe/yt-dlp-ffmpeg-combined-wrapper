import { bindText, findUnbound } from "./bind.js";
import type { Finding, PipelinePlan, Step, VerifySpec } from "./types.js";

export interface GuardFlags {
  readonly force?: boolean;
  readonly unsafe?: boolean;
  /** Returns true when the path exists. Omit to treat every output as present. */
  readonly exists?: (path: string) => boolean;
}

function finding(code: string, message: string, location?: string): Finding {
  return { severity: "error", code, message, location };
}

function placeholderNames(step: Step): readonly string[] {
  const texts: string[] = [];

  for (const arg of step.args) {
    texts.push(arg.name);
    if (arg.value !== undefined) texts.push(arg.value);
    for (const value of arg.values ?? []) texts.push(value);
    if (arg.alias !== undefined) texts.push(arg.alias);
  }

  for (const output of step.outputs ?? []) texts.push(output);
  for (const input of step.inputs ?? []) texts.push(input);
  if (step.verify?.command !== undefined) texts.push(step.verify.command);
  for (const path of step.verify?.exists ?? []) texts.push(path);

  const names = new Set<string>();
  for (const text of texts) {
    for (const name of findUnbound(text)) names.add(name);
  }
  return [...names];
}

export function checkBlocked(step: Step): readonly Finding[] {
  const names = placeholderNames(step);
  if (names.length === 0) return [];

  const list = names.map((name) => `{{${name}}}`).join(", ");
  return [
    finding("E_BLOCKED", `step "${step.id}" still has placeholders: ${list}`, `step:${step.id}`),
  ];
}

export function checkOverwrite(
  path: string,
  force: boolean,
  exists?: (value: string) => boolean,
): readonly Finding[] {
  if (force) return [];
  if (exists !== undefined && !exists(path)) return [];
  return [finding("E_OVERWRITE", `output "${path}" may overwrite an existing file`, path)];
}

export function checkUnsafe(step: Step, unsafe: boolean): readonly Finding[] {
  if (!step.unsafe) return [];
  if (unsafe) return [];
  return [finding("E_UNSAFE", `step "${step.id}" requires unsafe mode`, `step:${step.id}`)];
}

function bindVerify(spec: VerifySpec, vars: Readonly<Record<string, string>>): VerifySpec {
  return {
    ...spec,
    ...(spec.command !== undefined ? { command: bindText(spec.command, vars) } : {}),
    ...(spec.exists !== undefined
      ? { exists: spec.exists.map((path) => bindText(path, vars)) }
      : {}),
  };
}

function bindStepArgs(step: Step, vars: Readonly<Record<string, string>>): Step {
  return {
    ...step,
    args: step.args.map((arg) => ({
      ...arg,
      name: bindText(arg.name, vars),
      ...(arg.value !== undefined ? { value: bindText(arg.value, vars) } : {}),
      ...(arg.values !== undefined
        ? { values: arg.values.map((value) => bindText(value, vars)) }
        : {}),
      ...(arg.alias !== undefined ? { alias: bindText(arg.alias, vars) } : {}),
    })),
    ...(step.inputs !== undefined
      ? { inputs: step.inputs.map((input) => bindText(input, vars)) }
      : {}),
    ...(step.outputs !== undefined
      ? { outputs: step.outputs.map((output) => bindText(output, vars)) }
      : {}),
    ...(step.verify !== undefined ? { verify: bindVerify(step.verify, vars) } : {}),
  };
}

export function collectGuards(plan: PipelinePlan, flags: GuardFlags = {}): readonly Finding[] {
  const findings: Finding[] = [];
  const force = flags.force ?? plan.defaults?.force ?? false;
  const unsafe = flags.unsafe ?? plan.defaults?.unsafe ?? false;
  const vars = plan.vars ?? {};

  for (const step of plan.steps) {
    const bound = bindStepArgs(step, vars);
    findings.push(...checkBlocked(bound));
    findings.push(...checkUnsafe(bound, unsafe));
    for (const output of bound.outputs ?? []) {
      findings.push(...checkOverwrite(output, force, flags.exists));
    }
  }

  return findings;
}
