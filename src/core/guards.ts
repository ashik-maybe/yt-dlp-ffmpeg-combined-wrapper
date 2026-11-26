import { findUnbound } from "./bind.js";
import type { Finding, PipelinePlan, Step } from "./types.js";

export interface GuardFlags {
  readonly force?: boolean;
  readonly unsafe?: boolean;
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

export function checkOverwrite(path: string, force: boolean): readonly Finding[] {
  if (force) return [];
  return [finding("E_OVERWRITE", `output "${path}" may overwrite an existing file`, path)];
}

export function checkUnsafe(step: Step, unsafe: boolean): readonly Finding[] {
  if (!step.unsafe) return [];
  if (unsafe) return [];
  return [finding("E_UNSAFE", `step "${step.id}" requires unsafe mode`, `step:${step.id}`)];
}

export function collectGuards(plan: PipelinePlan, flags: GuardFlags = {}): readonly Finding[] {
  const findings: Finding[] = [];
  const force = flags.force ?? plan.defaults?.force ?? false;
  const unsafe = flags.unsafe ?? plan.defaults?.unsafe ?? false;

  for (const step of plan.steps) {
    findings.push(...checkBlocked(step));
    findings.push(...checkUnsafe(step, unsafe));
    for (const output of step.outputs ?? []) {
      findings.push(...checkOverwrite(output, force));
    }
  }

  return findings;
}
