export type Shell = "posix" | "powershell" | "cmd";

export type Tool = "yt-dlp" | "ffmpeg";

export type Severity = "error" | "warning" | "info";

export type Confidence = "verified" | "validated" | "unverified";

export type ArgKind = "flag" | "option" | "value";

export interface PlanArg {
  readonly kind: ArgKind;
  readonly name: string;
  readonly value?: string;
  readonly values?: readonly string[];
  readonly alias?: string;
}

export interface Command {
  readonly tool: Tool;
  readonly args: readonly PlanArg[];
  readonly shell: Shell;
}

export interface Recipe {
  readonly id: string;
  readonly name: string;
  readonly tool: Tool;
  readonly args: readonly PlanArg[];
  readonly confidence?: Confidence;
}

export interface Plan {
  readonly tool: Tool;
  readonly args: readonly PlanArg[];
  readonly shell: Shell;
  readonly confidence: Confidence;
}

export interface VerifySpec {
  readonly command?: string;
  readonly exists?: readonly string[];
  readonly expectExitCode?: number;
}

export interface Step {
  readonly id: string;
  readonly tool: Tool;
  readonly recipeId?: string;
  readonly args: readonly PlanArg[];
  readonly inputs?: readonly string[];
  readonly outputs?: readonly string[];
  readonly dependsOn?: readonly string[];
  readonly unsafe?: boolean;
  readonly verify?: VerifySpec;
}

export interface Defaults {
  readonly shell?: Shell;
  readonly force?: boolean;
  readonly unsafe?: boolean;
}

export interface PipelinePlan {
  readonly version: 1;
  readonly id: string;
  readonly name: string;
  readonly shell: Shell;
  readonly vars?: Readonly<Record<string, string>>;
  readonly defaults?: Defaults;
  readonly steps: readonly Step[];
}

export interface Finding {
  readonly severity: Severity;
  readonly code: string;
  readonly message: string;
  readonly location?: string;
  readonly fix?: string;
}

export interface StepResult {
  readonly stepId: string;
  readonly ok: boolean;
  readonly exitCode?: number;
  readonly stdout?: string;
  readonly stderr?: string;
  readonly findings: readonly Finding[];
}
