import { bindText, findUnbound } from "../../core/index.js";
import type { Finding, PlanArg, Step, Tool, VerifySpec } from "../../core/index.js";
import type { StepResolution, ToolAdapter } from "../../contracts/adapter.js";

const TOOL: Tool = "yt-dlp";

const UNSAFE_FLAGS: readonly string[] = ["exec", "exec-before-download", "postprocessor-args"];

const OUTPUT_FLAGS: readonly string[] = ["o", "output"];

function stripDashes(name: string): string {
  return name.replace(/^-+/, "");
}

function argTexts(arg: PlanArg): readonly string[] {
  const texts: string[] = [arg.name];
  if (arg.alias !== undefined) texts.push(arg.alias);
  if (arg.value !== undefined) texts.push(arg.value);
  if (arg.values !== undefined) texts.push(...arg.values);
  return texts;
}

function bindArg(arg: PlanArg, vars: Readonly<Record<string, string>>): PlanArg {
  return {
    kind: arg.kind,
    name: bindText(arg.name, vars),
    ...(arg.value !== undefined ? { value: bindText(arg.value, vars) } : {}),
    ...(arg.values !== undefined ? { values: arg.values.map((value) => bindText(value, vars)) } : {}),
    ...(arg.alias !== undefined ? { alias: bindText(arg.alias, vars) } : {}),
  };
}

function unboundFindings(
  step: Step,
  vars: Readonly<Record<string, string>>,
): readonly Finding[] {
  const findings: Finding[] = [];
  const seen = new Set<string>();
  for (const arg of step.args) {
    for (const text of argTexts(arg)) {
      for (const name of findUnbound(text, vars)) {
        if (seen.has(name)) continue;
        seen.add(name);
        findings.push({
          severity: "error",
          code: "E_UNBOUND_VAR",
          message: `variable "${name}" has no value`,
          location: `step:${step.id}`,
          fix: `define vars.${name}`,
        });
      }
    }
  }
  return findings;
}

function unsafeFlag(name: string): boolean {
  return UNSAFE_FLAGS.includes(stripDashes(name));
}

function outputToDash(arg: PlanArg): boolean {
  const token = stripDashes(arg.alias ?? arg.name);
  if (!OUTPUT_FLAGS.includes(token)) return false;
  if (arg.value === "-") return true;
  return arg.values?.includes("-") ?? false;
}

export function bindArgs(
  args: readonly PlanArg[],
  vars: Readonly<Record<string, string>>,
): readonly PlanArg[] {
  return args.map((arg) => bindArg(arg, vars));
}

export function requiresUnsafe(step: Step): boolean {
  if (step.unsafe === true) return true;
  return step.args.some((arg) => unsafeFlag(arg.alias ?? arg.name) || outputToDash(arg));
}

export function defaultVerify(step: Step): VerifySpec {
  if (step.verify !== undefined) return step.verify;
  const outputs = step.outputs ?? [];
  if (outputs.length > 0) return { exists: outputs, expectExitCode: 0 };
  return { expectExitCode: 0 };
}

export function planFromStep(
  step: Step,
  vars: Readonly<Record<string, string>>,
): StepResolution {
  const findings: Finding[] = [];
  if (step.tool !== TOOL) {
    findings.push({
      severity: "error",
      code: "E_TOOL_MISMATCH",
      message: `step "${step.id}" uses tool "${step.tool}", adapter handles "${TOOL}"`,
      location: `step:${step.id}`,
    });
  }
  findings.push(...unboundFindings(step, vars));
  return {
    args: bindArgs(step.args, vars),
    findings,
  };
}

export const ytDlpAdapter: ToolAdapter = {
  tool: TOOL,
  planFromStep,
  requiresUnsafe,
  defaultVerify,
};
