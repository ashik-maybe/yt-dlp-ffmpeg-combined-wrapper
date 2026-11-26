import { Box, Text } from "ink";
import type { ScreenProps } from "../types.js";
import { APP_NAME, theme } from "../theme.js";

export interface ChromeProps extends Pick<ScreenProps, "version" | "narrow"> {
  readonly stepCount: number;
}

export function Chrome({ version, stepCount, narrow }: ChromeProps) {
  return (
    <Box flexDirection={narrow ? "column" : "row"} columnGap={narrow ? 0 : 2}>
      <Text bold color={theme.accent}>
        {APP_NAME}
      </Text>
      <Text>v{version}</Text>
      <Text>steps: {stepCount}</Text>
    </Box>
  );
}
