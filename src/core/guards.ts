import type { Finding, PipelinePlan, Step } from "./types.js";

export interface GuardFlags {
  readonly force?: boolean;
  readonly unsafe?: boolean;
}

function finding(code: string, message: string, location?: string): Finding {
  return { severity: "error", code, message, location };
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
    findings.push(...checkUnsafe(step, unsafe));
    for (const output of step.outputs ?? []) {
      findings.push(...checkOverwrite(output, force));
    }
  }

  return findings;
}
