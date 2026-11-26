import { Box, Text, useApp, useInput } from "ink";
import type { ScreenProps, StepView } from "../types.js";

export type VerifyOutcome = "passed" | "failed" | "skipped";

export interface SummaryProps extends ScreenProps {
  /** Steps from the finished run. */
  readonly steps: readonly StepView[];
  /** Outcome of the plan verification. */
  readonly verification?: VerifyOutcome;
  /** Verification command that ran, when known. */
  readonly verifyCommand?: string;
  /** Called when the user presses q. Defaults to exiting the app. */
  readonly onQuit?: () => void;
}

const VERIFY_COLOR: Readonly<Record<VerifyOutcome, string>> = {
  passed: "green",
  failed: "red",
  skipped: "gray",
};

/** Screen that shows the final result, verification, and failed steps. */
export function Summary({ steps, verification = "skipped", verifyCommand, onQuit }: SummaryProps) {
  const { exit } = useApp();
  const failedSteps = steps.filter((step) => step.status === "failed");
  const done = steps.filter((step) => step.status === "ok").length;
  const failed = failedSteps.length > 0 || verification === "failed";

  useInput((input) => {
    if (input !== "q") return;
    if (onQuit !== undefined) {
      onQuit();
      return;
    }
    exit();
  });

  return (
    <Box flexDirection="column">
      <Text bold>Summary</Text>
      <Text color={failed ? "red" : "green"}>Result: {failed ? "failed" : "ok"}</Text>
      <Text color={VERIFY_COLOR[verification]}>
        Verification: {verification}
        {verifyCommand !== undefined ? ` (${verifyCommand})` : ""}
      </Text>
      <Text dimColor>
        Steps: {done}/{steps.length} ok
      </Text>
      <Box flexDirection="column" marginTop={1}>
        <Text bold>Failed steps:</Text>
        {failedSteps.length === 0 ? (
          <Text dimColor>none</Text>
        ) : (
          failedSteps.map((step) => (
            <Box key={step.id} flexDirection="column">
              <Text color="red">
                [!] {step.label} ({step.tool})
              </Text>
              <Text dimColor wrap="truncate-end">
                {"  "}
                {step.command}
              </Text>
            </Box>
          ))
        )}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>q quit</Text>
      </Box>
    </Box>
  );
}
