import { renderArg } from "../core/index.js";
import type { Finding, PipelinePlan, PlanArg, Tool } from "../core/index.js";
import { adapterFor } from "../planners/index.js";

export interface RenderedPlan {
  readonly ok: boolean;
  readonly commands: readonly string[];
  readonly findings: readonly Finding[];
}

export function renderStepCommand(tool: Tool, args: readonly PlanArg[]): string {
  return [tool, ...args.map(renderArg)].join(" ");
}

export function formatFinding(finding: Finding): string {
  return `${finding.code}: ${finding.message}`;
}

/** Resolve every step through its adapter. Renders nothing to the terminal. */
export function renderPlan(plan: PipelinePlan): RenderedPlan {
  const vars = plan.vars ?? {};
  const commands: string[] = [];
  const findings: Finding[] = [];

  for (const step of plan.steps) {
    const resolution = adapterFor(step.tool).planFromStep(step, vars);
    findings.push(...resolution.findings);
    commands.push(renderStepCommand(step.tool, resolution.args));
  }

  const ok = findings.every((finding) => finding.severity !== "error");
  return { ok, commands, findings };
}
