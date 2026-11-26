import { bindText, collectGuards, renderArg } from "../core/index.js";
import type { Finding, PipelinePlan, PlanArg, Step, Tool } from "../core/index.js";
import { adapterFor } from "../planners/index.js";

export interface RenderedPlan {
  readonly ok: boolean;
  readonly commands: readonly string[];
  readonly findings: readonly Finding[];
}

export interface RenderFlags {
  readonly force?: boolean;
  readonly unsafe?: boolean;
  readonly exists?: (path: string) => boolean;
}

export function renderStepCommand(tool: Tool, args: readonly PlanArg[]): string {
  return [tool, ...args.map(renderArg)].join(" ");
}

export function formatFinding(finding: Finding): string {
  return `${finding.code}: ${finding.message}`;
}

/** Resolve every step through its adapter. Renders nothing to the terminal. */
export function renderPlan(plan: PipelinePlan, flags: RenderFlags = {}): RenderedPlan {
  const vars = plan.vars ?? {};
  const commands: string[] = [];
  const findings: Finding[] = [
    ...collectGuards(plan, { ...flags, exists: flags.exists ?? (() => false) }),
  ];

  for (const step of plan.steps) {
    const adapter = adapterFor(step.tool);
    const resolution = adapter.planFromStep(step, vars);
    findings.push(...resolution.findings);

    const boundStep: Step = {
      ...step,
      args: resolution.args,
      outputs: step.outputs?.map((output) => bindText(output, vars)),
    };
    if (step.unsafe !== true && !flags.unsafe && adapter.requiresUnsafe(boundStep)) {
      findings.push({
        severity: "error",
        code: "E_UNSAFE",
        message: `step "${step.id}" requires unsafe mode`,
        location: `step:${step.id}`,
      });
    }

    commands.push(renderStepCommand(step.tool, resolution.args));
  }

  const ok = findings.every((finding) => finding.severity !== "error");
  return { ok, commands, findings };
}
