import { existsSync } from "node:fs";
import { bindText, collectGuards, renderCommand, topoOrder, validateDag } from "../core/index.js";
import type { Finding, PipelinePlan, Step, StepResult, Tool, VerifySpec } from "../core/index.js";
import type { ToolAdapter } from "../contracts/index.js";
import { runProcess } from "./process.js";
import { verifyStep } from "./verify.js";

export interface ProcessOutcome {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

export type ProcessRunner = (
  argv: readonly string[],
  step: Step,
) => ProcessOutcome | Promise<ProcessOutcome>;

export type VerifyFn = (result: StepResult, spec: VerifySpec) => StepResult | Promise<StepResult>;

export interface ExecuteDeps {
  readonly run?: ProcessRunner;
  readonly verify?: VerifyFn;
  readonly dryRun?: boolean;
  readonly unsafe?: boolean;
  readonly force?: boolean;
  readonly signal?: AbortSignal;
}

function errorFinding(code: string, message: string, location?: string): Finding {
  return { severity: "error", code, message, location };
}

function bindSpec(spec: VerifySpec, vars: Readonly<Record<string, string>>): VerifySpec {
  const bound: {
    command?: string;
    exists?: readonly string[];
    expectExitCode?: number;
  } = {};
  if (spec.command !== undefined) {
    bound.command = bindText(spec.command, vars);
  }
  if (spec.exists !== undefined) {
    bound.exists = spec.exists.map((path) => bindText(path, vars));
  }
  if (spec.expectExitCode !== undefined) {
    bound.expectExitCode = spec.expectExitCode;
  }
  return bound;
}

export async function executePlan(
  plan: PipelinePlan,
  adapters: Readonly<Partial<Record<Tool, ToolAdapter>>>,
  deps: ExecuteDeps = {},
): Promise<readonly StepResult[]> {
  const dag = validateDag(plan.steps);
  if (!dag.ok) {
    return [{ stepId: plan.id, ok: false, findings: dag.findings }];
  }

  const order = topoOrder(plan.steps).order;
  const byId = new Map(plan.steps.map((step) => [step.id, step]));
  const vars = plan.vars ?? {};
  const dryRun = deps.dryRun ?? true;
  const unsafe = deps.unsafe ?? plan.defaults?.unsafe ?? false;
  const force = deps.force ?? plan.defaults?.force ?? false;
  const guards = collectGuards(plan, { force, unsafe, exists: existsSync });
  if (guards.some((finding) => finding.severity === "error")) {
    return [{ stepId: plan.id, ok: false, findings: guards }];
  }
  const results: StepResult[] = [];

  for (const id of order) {
    const step = byId.get(id);
    if (step === undefined) continue;

    const adapter = adapters[step.tool];
    if (adapter === undefined) {
      results.push({
        stepId: step.id,
        ok: false,
        findings: [
          errorFinding("E_NO_ADAPTER", `no adapter for tool "${step.tool}"`, `step:${step.id}`),
        ],
      });
      break;
    }

    const resolution = adapter.planFromStep(step, vars);
    if (resolution.findings.some((finding) => finding.severity === "error")) {
      results.push({ stepId: step.id, ok: false, findings: resolution.findings });
      break;
    }

    const boundStep: Step = {
      ...step,
      args: resolution.args,
      outputs: step.outputs?.map((output) => bindText(output, vars)),
    };
    const argv = renderCommand(step.tool, resolution.args);
    if (dryRun) {
      results.push({
        stepId: step.id,
        ok: true,
        findings: [
          ...resolution.findings,
          {
            severity: "info",
            code: "I_DRY_RUN",
            message: `dry run: ${argv.join(" ")}`,
            location: `step:${step.id}`,
          },
        ],
      });
      continue;
    }

    if (adapter.requiresUnsafe(boundStep) && !unsafe) {
      results.push({
        stepId: step.id,
        ok: false,
        findings: [
          ...resolution.findings,
          errorFinding("E_UNSAFE", `step "${step.id}" requires unsafe mode`, `step:${step.id}`),
        ],
      });
      break;
    }

    let outcome: ProcessOutcome;
    try {
      const run =
        deps.run ??
        ((args: readonly string[]) =>
          runProcess(args, { signal: deps.signal }).then((result) => ({
            exitCode: result.exitCode,
            stdout: result.stdout,
            stderr: result.stderr,
          })));
      outcome = await run(argv, step);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      results.push({
        stepId: step.id,
        ok: false,
        findings: [
          ...resolution.findings,
          errorFinding("E_PROCESS_ERROR", `process failed: ${detail}`, `step:${step.id}`),
        ],
      });
      break;
    }

    const executed: StepResult = {
      stepId: step.id,
      ok: outcome.exitCode === 0,
      exitCode: outcome.exitCode,
      stdout: outcome.stdout,
      stderr: outcome.stderr,
      findings: resolution.findings,
    };

    if (outcome.exitCode !== 0) {
      results.push({
        ...executed,
        findings: [
          ...resolution.findings,
          errorFinding(
            "E_STEP_FAILED",
            `step "${step.id}" exited with code ${outcome.exitCode}`,
            `step:${step.id}`,
          ),
        ],
      });
      break;
    }

    const spec =
      step.verify !== undefined ? bindSpec(step.verify, vars) : adapter.defaultVerify(boundStep);
    const verify = deps.verify ?? verifyStep;
    const verified = await verify(executed, spec);
    results.push(verified);
    if (!verified.ok) break;
  }

  return results;
}
