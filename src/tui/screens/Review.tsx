import { Box, Text, useInput } from "ink";
import type { ReactElement } from "react";
import type { Finding } from "../../core/index.js";
import type { ScreenProps, StepStatus, StepView } from "../types.js";

export interface ReviewProps extends ScreenProps {
  readonly steps: readonly StepView[];
  readonly findings?: readonly Finding[];
  readonly onContinue: () => void;
}

const STATUS_MARK: Readonly<Record<StepStatus, string>> = {
  pending: "-",
  running: ">",
  ok: "+",
  failed: "x",
  skipped: ".",
};

function severityColor(severity: Finding["severity"]): string {
  if (severity === "error") return "red";
  if (severity === "warning") return "yellow";
  return "blue";
}

export function Review(props: ReviewProps): ReactElement {
  const { steps, findings = [], selectedId, onSelect, onBack, onContinue, narrow, version } = props;
  const active = Math.max(
    0,
    steps.findIndex((step) => step.id === selectedId),
  );

  useInput((_input, key) => {
    if (key.escape) {
      onBack();
      return;
    }

    if (key.return) {
      onContinue();
      return;
    }

    if ((key.upArrow || key.downArrow) && steps.length > 0) {
      const delta = key.upArrow ? steps.length - 1 : 1;
      onSelect(steps[(active + delta) % steps.length].id);
    }
  });

  return (
    <Box flexDirection="column">
      <Text bold>{narrow ? "Review" : `Review plan: ${steps.length} step(s)`}</Text>
      {steps.length === 0 ? <Text dimColor>No steps to review.</Text> : null}
      {steps.map((step, index) => {
        const selected = index === active;
        return (
          <Box key={step.id} flexDirection="column" marginTop={index === 0 ? 1 : 0}>
            <Text color={selected ? "cyan" : undefined}>
              {selected ? ">" : " "} {index + 1}. [{STATUS_MARK[step.status]}] {step.tool} ·{" "}
              {step.label} <Text dimColor>({step.id})</Text>
            </Text>
            <Text dimColor wrap="wrap">
              {"    $ "}
              {step.command}
            </Text>
          </Box>
        );
      })}

      <Box flexDirection="column" marginTop={1}>
        <Text bold>Guard findings ({findings.length})</Text>
        {findings.length === 0 ? <Text dimColor>No guard findings.</Text> : null}
        {findings.map((finding, index) => (
          <Text
            key={`${finding.code}-${index}`}
            color={severityColor(finding.severity)}
            wrap="wrap"
          >
            {finding.severity.toUpperCase()} {finding.code}: {finding.message}
            {finding.location ? ` [${finding.location}]` : ""}
            {finding.fix ? ` Fix: ${finding.fix}` : ""}
          </Text>
        ))}
      </Box>

      <Box marginTop={1}>
        <Text dimColor>
          {narrow
            ? "↑/↓ select · Enter continue · Esc back"
            : `↑/↓ select · Enter continue · Esc back · v${version}`}
        </Text>
      </Box>
    </Box>
  );
}

export default Review;
