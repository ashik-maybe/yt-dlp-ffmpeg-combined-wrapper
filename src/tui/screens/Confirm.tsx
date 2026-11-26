import { Box, Text, useInput } from "ink";
import type { ReactElement } from "react";
import type { Finding } from "../../core/index.js";
import type { ScreenProps, StepView } from "../types.js";

export interface ConfirmProps extends ScreenProps {
  readonly steps: readonly StepView[];
  readonly findings?: readonly Finding[];
  readonly onConfirm: () => void;
}

export function deriveRiskySteps(
  steps: readonly StepView[],
  findings: readonly Finding[],
): readonly StepView[] {
  const errors = findings.filter((finding) => finding.severity === "error");
  if (errors.length === 0) return [];

  const ids = new Set<string>();
  for (const finding of errors) {
    if (finding.location?.startsWith("step:")) {
      ids.add(finding.location.slice("step:".length));
    }
  }

  const matched = steps.filter((step) => ids.has(step.id));
  if (matched.length > 0) return matched;
  return steps;
}

export function Confirm(props: ConfirmProps): ReactElement {
  const { steps, findings = [], onBack, onConfirm, narrow, version } = props;
  const risky = deriveRiskySteps(steps, findings);
  const errors = findings.filter((finding) => finding.severity === "error");

  useInput((input, key) => {
    if (key.escape) {
      onBack();
      return;
    }

    if (input === "y" || input === "Y") {
      onConfirm();
    }
  });

  return (
    <Box flexDirection="column">
      <Text bold>{narrow ? "Confirm" : `Confirm ${risky.length} risky step(s)`}</Text>
      {risky.length === 0 ? <Text dimColor>No risky steps.</Text> : null}
      {risky.map((step) => (
        <Box key={step.id} flexDirection="column" marginTop={1}>
          <Text color="red">
            ! {step.tool} - {step.label} <Text dimColor>({step.id})</Text>
          </Text>
          <Text dimColor wrap="wrap">
            {"    $ "}
            {step.command}
          </Text>
        </Box>
      ))}

      {errors.length > 0 ? (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>Reasons ({errors.length})</Text>
          {errors.map((finding, index) => (
            <Text key={`${finding.code}-${index}`} color="red" wrap="wrap">
              {finding.code}: {finding.message}
            </Text>
          ))}
        </Box>
      ) : null}

      <Box marginTop={1}>
        <Text>Press y to confirm - Esc to go back</Text>
      </Box>
      <Text dimColor>v{version}</Text>
    </Box>
  );
}

export default Confirm;
