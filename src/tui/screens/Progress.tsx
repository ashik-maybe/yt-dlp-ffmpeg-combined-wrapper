import { Box, Text } from "ink";
import type { ScreenProps, StepStatus, StepView } from "../types.js";

export interface ProgressProps extends ScreenProps {
  /** Steps to display, in run order. */
  readonly steps: readonly StepView[];
  /** Captured output lines. The last non-empty line is shown. */
  readonly logs?: readonly string[];
}

const STEP_MARK: Readonly<Record<StepStatus, string>> = {
  pending: "[ ]",
  running: "[>]",
  ok: "[x]",
  failed: "[!]",
  skipped: "[-]",
};

const STEP_COLOR: Readonly<Record<StepStatus, string | undefined>> = {
  pending: undefined,
  running: "yellow",
  ok: "green",
  failed: "red",
  skipped: "gray",
};

const BAR_WIDTH = 20;
const NARROW_BAR_WIDTH = 10;

interface StepTotals {
  readonly total: number;
  readonly done: number;
  readonly failed: boolean;
  readonly percent: number;
}

function summarize(steps: readonly StepView[]): StepTotals {
  const total = steps.length;
  const done = steps.filter((step) => step.status === "ok").length;
  const failed = steps.some((step) => step.status === "failed");
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return { total, done, failed, percent };
}

function renderBar(percent: number, width: number): string {
  const filled = Math.round((percent / 100) * width);
  return `${"#".repeat(filled)}${"-".repeat(width - filled)}`;
}

/** Screen that shows step status, progress, and the last log line. */
export function Progress({ steps, logs = [], narrow, version }: ProgressProps) {
  const { total, done, failed, percent } = summarize(steps);
  const width = narrow ? NARROW_BAR_WIDTH : BAR_WIDTH;
  const bar = renderBar(percent, width);
  const lastLog = logs.filter((line) => line.trim().length > 0).at(-1);

  return (
    <Box flexDirection="column">
      <Text bold>
        Progress <Text dimColor>v{version}</Text>
      </Text>
      <Text>
        <Text color={failed ? "red" : "green"}>[{bar}]</Text> {percent}% {done}/{total} done
      </Text>
      <Box flexDirection="column" marginTop={1}>
        {steps.map((step) => (
          <Text
            key={step.id}
            color={STEP_COLOR[step.status]}
            dimColor={step.status === "pending"}
          >
            {STEP_MARK[step.status]} {step.label} ({step.status})
          </Text>
        ))}
      </Box>
      <Box flexDirection="column" marginTop={1}>
        <Text dimColor>Last log:</Text>
        <Text wrap="truncate-end">{lastLog ?? "No output yet."}</Text>
      </Box>
    </Box>
  );
}
