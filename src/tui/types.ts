import type { PipelinePlan, Tool } from "../core/index.js";

export type ScreenName = "picker" | "more" | "review" | "confirm" | "progress" | "summary";

export type StepStatus = "pending" | "running" | "ok" | "failed" | "skipped";

export interface TaskItem {
  readonly id: string;
  readonly tool: Tool;
  readonly label: string;
  readonly hint: string;
}

export interface StepView {
  readonly id: string;
  readonly tool: Tool;
  readonly label: string;
  readonly command: string;
  readonly status: StepStatus;
}

export interface ScreenProps {
  readonly tasks: readonly TaskItem[];
  readonly selectedId: string;
  readonly onSelect: (id: string) => void;
  readonly onBack: () => void;
  readonly narrow: boolean;
  readonly version: string;
}

export interface TuiProps {
  readonly runEnabled: boolean;
  readonly yes: boolean;
  readonly force: boolean;
  readonly unsafe: boolean;
  readonly plan: PipelinePlan;
}
