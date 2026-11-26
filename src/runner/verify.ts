import { spawnSync } from "node:child_process";
import { statSync } from "node:fs";
import type { Finding, StepResult, VerifySpec } from "../core/index.js";

export interface CommandOutcome {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

export type CommandRunner = (command: string) => CommandOutcome | Promise<CommandOutcome>;

export interface VerifyDeps {
  readonly run?: CommandRunner;
  readonly sizeOf?: (path: string) => number | undefined;
}

function errorFinding(code: string, message: string, location?: string): Finding {
  return { severity: "error", code, message, location };
}

function defaultRun(command: string): CommandOutcome {
  const result = spawnSync(command, { shell: true, encoding: "utf8" });
  const stdout = typeof result.stdout === "string" ? result.stdout : "";
  const captured = typeof result.stderr === "string" ? result.stderr : "";
  const stderr = captured.length > 0 ? captured : (result.error?.message ?? "");
  return { code: result.status ?? 1, stdout, stderr };
}

function defaultSizeOf(path: string): number | undefined {
  try {
    const stat = statSync(path);
    return stat.isFile() ? stat.size : undefined;
  } catch {
    return undefined;
  }
}

export async function verifyStep(
  result: StepResult,
  spec: VerifySpec,
  deps: VerifyDeps = {},
): Promise<StepResult> {
  const findings: Finding[] = [...result.findings];
  const location = `step:${result.stepId}`;

  if (spec.expectExitCode !== undefined) {
    if (result.exitCode === undefined) {
      findings.push({
        severity: "warning",
        code: "W_EXIT_UNKNOWN",
        message: "exit code is unknown; the expected code was not checked",
        location,
      });
    } else if (result.exitCode !== spec.expectExitCode) {
      findings.push(
        errorFinding(
          "E_VERIFY_EXIT",
          `expected exit code ${spec.expectExitCode}, got ${result.exitCode}`,
          location,
        ),
      );
    }
  }

  const sizeOf = deps.sizeOf ?? defaultSizeOf;
  for (const path of spec.exists ?? []) {
    const size = sizeOf(path);
    if (size === undefined) {
      findings.push(errorFinding("E_OUTPUT_MISSING", `output "${path}" is missing`, path));
    } else if (size === 0) {
      findings.push(errorFinding("E_OUTPUT_EMPTY", `output "${path}" is empty`, path));
    }
  }

  const command = spec.command?.trim();
  if (command !== undefined && command.length > 0) {
    const run = deps.run ?? defaultRun;
    try {
      const outcome = await run(command);
      if (outcome.code !== 0) {
        const detail = outcome.stderr.trim();
        const message =
          detail.length > 0
            ? `verification command failed with code ${outcome.code}: ${detail}`
            : `verification command failed with code ${outcome.code}`;
        findings.push(errorFinding("E_VERIFY_COMMAND", message, location));
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      findings.push(
        errorFinding("E_VERIFY_COMMAND", `verification command failed: ${detail}`, location),
      );
    }
  }

  return {
    ...result,
    ok: result.ok && findings.every((finding) => finding.severity !== "error"),
    findings,
  };
}
