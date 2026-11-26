import { Box, Text } from "ink";
import type { ScreenProps, StepView } from "../types.js";
import { statusMark, theme } from "../theme.js";

export interface StepListProps extends Pick<ScreenProps, "narrow"> {
  readonly steps: readonly StepView[];
  readonly selectedId?: string;
  readonly title?: string;
}

export function StepList({ steps, selectedId, narrow, title = "Steps" }: StepListProps) {
  return (
    <Box flexDirection="column">
      <Text bold color={theme.accent}>
        {title} ({steps.length})
      </Text>
      {steps.length === 0 ? (
        <Text dimColor>No steps.</Text>
      ) : (
        steps.map((step, index) => {
          const selected = step.id === selectedId;
          return (
            <Box key={step.id} flexDirection="column">
              <Text bold={selected} color={selected ? theme.accent : undefined}>
                {selected ? ">" : " "} {index + 1}. {statusMark(step.status)} {step.label} [{step.tool}]
              </Text>
              {narrow ? null : <Text dimColor>    {step.command}</Text>}
            </Box>
          );
        })
      )}
    </Box>
  );
}
