import type { ArgKind, Finding, PipelinePlan, Shell, Tool } from "./types.js";

export interface ValidationResult {
  readonly ok: boolean;
  readonly plan?: PipelinePlan;
  readonly findings: readonly Finding[];
}

const SHELLS: readonly Shell[] = ["posix", "powershell", "cmd"];
const TOOLS: readonly Tool[] = ["yt-dlp", "ffmpeg"];
const ARG_KINDS: readonly ArgKind[] = ["flag", "option", "value"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function err(code: string, message: string, location?: string): Finding {
  return { severity: "error", code, message, location };
}

function validateString(value: unknown, code: string, location: string): Finding[] {
  if (typeof value !== "string" || value.length === 0) {
    return [err(code, `${location} must be a non-empty string`, location)];
  }
  return [];
}

function validatePlanArg(value: unknown, location: string): Finding[] {
  if (!isRecord(value)) {
    return [err("E_BAD_SHAPE", `${location} must be an object`, location)];
  }
  const findings: Finding[] = [];
  if (!ARG_KINDS.includes(value.kind as ArgKind)) {
    findings.push(err("E_BAD_SHAPE", `${location}.kind is invalid`, location));
  }
  findings.push(...validateString(value.name, "E_BAD_SHAPE", `${location}.name`));
  if (value.value !== undefined && typeof value.value !== "string") {
    findings.push(err("E_BAD_SHAPE", `${location}.value must be a string`, location));
  }
  if (value.values !== undefined) {
    if (!Array.isArray(value.values) || value.values.some((v) => typeof v !== "string")) {
      findings.push(err("E_BAD_SHAPE", `${location}.values must be string[]`, location));
    }
  }
  if (value.alias !== undefined && typeof value.alias !== "string") {
    findings.push(err("E_BAD_SHAPE", `${location}.alias must be a string`, location));
  }
  return findings;
}

function validateVerify(value: unknown, location: string): Finding[] {
  if (!isRecord(value)) {
    return [err("E_BAD_SHAPE", `${location} must be an object`, location)];
  }
  const findings: Finding[] = [];
  if (value.command !== undefined && typeof value.command !== "string") {
    findings.push(err("E_BAD_SHAPE", `${location}.command must be a string`, location));
  }
  if (value.exists !== undefined) {
    if (!Array.isArray(value.exists) || value.exists.some((v) => typeof v !== "string")) {
      findings.push(err("E_BAD_SHAPE", `${location}.exists must be string[]`, location));
    }
  }
  if (
    value.expectExitCode !== undefined &&
    (typeof value.expectExitCode !== "number" || !Number.isInteger(value.expectExitCode))
  ) {
    findings.push(err("E_BAD_SHAPE", `${location}.expectExitCode must be an integer`, location));
  }
  return findings;
}

function validateStep(value: unknown, index: number): Finding[] {
  const location = `steps[${index}]`;
  if (!isRecord(value)) {
    return [err("E_BAD_SHAPE", `${location} must be an object`, location)];
  }
  const findings: Finding[] = [];
  findings.push(...validateString(value.id, "E_MISSING_ID", `${location}.id`));
  if (!TOOLS.includes(value.tool as Tool)) {
    findings.push(err("E_UNKNOWN_TOOL", `${location}.tool is unknown`, location));
  }
  if (value.recipeId !== undefined && typeof value.recipeId !== "string") {
    findings.push(err("E_BAD_SHAPE", `${location}.recipeId must be a string`, location));
  }
  if (!Array.isArray(value.args)) {
    findings.push(err("E_BAD_SHAPE", `${location}.args must be an array`, location));
  } else {
    value.args.forEach((arg, i) => {
      findings.push(...validatePlanArg(arg, `${location}.args[${i}]`));
    });
  }
  for (const key of ["inputs", "outputs", "dependsOn"] as const) {
    const v = value[key];
    if (v !== undefined) {
      if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) {
        findings.push(err("E_BAD_SHAPE", `${location}.${key} must be string[]`, location));
      }
    }
  }
  if (value.unsafe !== undefined && typeof value.unsafe !== "boolean") {
    findings.push(err("E_BAD_SHAPE", `${location}.unsafe must be boolean`, location));
  }
  if (value.verify !== undefined) {
    findings.push(...validateVerify(value.verify, `${location}.verify`));
  }
  return findings;
}

function validateDefaults(value: unknown, location: string): Finding[] {
  if (!isRecord(value)) {
    return [err("E_BAD_SHAPE", `${location} must be an object`, location)];
  }
  const findings: Finding[] = [];
  if (value.shell !== undefined && !SHELLS.includes(value.shell as Shell)) {
    findings.push(err("E_BAD_SHAPE", `${location}.shell is invalid`, location));
  }
  if (value.force !== undefined && typeof value.force !== "boolean") {
    findings.push(err("E_BAD_SHAPE", `${location}.force must be boolean`, location));
  }
  if (value.unsafe !== undefined && typeof value.unsafe !== "boolean") {
    findings.push(err("E_BAD_SHAPE", `${location}.unsafe must be boolean`, location));
  }
  return findings;
}

export function validatePlan(value: unknown): ValidationResult {
  if (!isRecord(value)) {
    return {
      ok: false,
      findings: [err("E_BAD_SHAPE", "plan must be an object", "plan")],
    };
  }

  const findings: Finding[] = [];

  if (value.version !== 1) {
    findings.push(err("E_UNKNOWN_VERSION", "plan.version must be 1", "plan.version"));
  }
  findings.push(...validateString(value.id, "E_MISSING_ID", "plan.id"));
  findings.push(...validateString(value.name, "E_BAD_SHAPE", "plan.name"));
  if (!SHELLS.includes(value.shell as Shell)) {
    findings.push(err("E_BAD_SHAPE", "plan.shell is invalid", "plan.shell"));
  }
  if (value.vars !== undefined) {
    if (!isRecord(value.vars) || Object.values(value.vars).some((v) => typeof v !== "string")) {
      findings.push(err("E_BAD_SHAPE", "plan.vars must be Record<string,string>", "plan.vars"));
    }
  }
  if (value.defaults !== undefined) {
    findings.push(...validateDefaults(value.defaults, "plan.defaults"));
  }

  if (!Array.isArray(value.steps)) {
    findings.push(err("E_BAD_SHAPE", "plan.steps must be an array", "plan.steps"));
  } else {
    const seen = new Set<string>();
    value.steps.forEach((step, i) => {
      findings.push(...validateStep(step, i));
      if (isRecord(step) && typeof step.id === "string" && step.id.length > 0) {
        if (seen.has(step.id)) {
          findings.push(err("E_DUPLICATE_ID", `duplicate step id "${step.id}"`, `steps[${i}].id`));
        }
        seen.add(step.id);
      }
    });
  }

  const ok = findings.every((f) => f.severity !== "error");
  return {
    ok,
    plan: ok ? (value as unknown as PipelinePlan) : undefined,
    findings,
  };
}
