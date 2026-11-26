import { bindText, findUnbound } from "../core/index.js";
import type { Finding, PlanArg, Step, Tool, VerifySpec } from "../core/index.js";

export interface StepResolution {
  readonly args: readonly PlanArg[];
  readonly findings: readonly Finding[];
}

export interface ToolAdapter {
  readonly tool: Tool;
  planFromStep(step: Step, vars: Readonly<Record<string, string>>): StepResolution;
  requiresUnsafe(step: Step): boolean;
  defaultVerify(step: Step): VerifySpec;
}

const UNSAFE_FLAGS: Readonly<Record<Tool, readonly string[]>> = {
  "yt-dlp": ["exec", "exec-before-download", "postprocessor-args"],
  ffmpeg: [],
};

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
    ...(arg.values !== undefined ? { values: arg.values.map((v) => bindText(v, vars)) } : {}),
    ...(arg.alias !== undefined ? { alias: bindText(arg.alias, vars) } : {}),
  };
}

function unboundFindings(step: Step, vars: Readonly<Record<string, string>>): readonly Finding[] {
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

export function createAdapter(tool: Tool): ToolAdapter {
  const unsafeFlags = UNSAFE_FLAGS[tool];
  return {
    tool,
    planFromStep(step, vars) {
      const findings: Finding[] = [];
      if (step.tool !== tool) {
        findings.push({
          severity: "error",
          code: "E_TOOL_MISMATCH",
          message: `step "${step.id}" uses tool "${step.tool}", adapter handles "${tool}"`,
          location: `step:${step.id}`,
        });
      }
      findings.push(...unboundFindings(step, vars));
      return {
        args: step.args.map((arg) => bindArg(arg, vars)),
        findings,
      };
    },
    requiresUnsafe(step) {
      if (step.unsafe === true) return true;
      return step.args.some((arg) => unsafeFlags.includes(stripDashes(arg.alias ?? arg.name)));
    },
    defaultVerify(step) {
      if (step.verify !== undefined) return step.verify;
      const outputs = step.outputs ?? [];
      if (outputs.length > 0) return { exists: outputs };
      return { expectExitCode: 0 };
    },
  };
}

export const toolAdapters: Readonly<Record<Tool, ToolAdapter>> = {
  "yt-dlp": createAdapter("yt-dlp"),
  ffmpeg: createAdapter("ffmpeg"),
};
