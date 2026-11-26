import { Box, Text } from "ink";
import type { ScreenProps } from "../types.js";
import { theme } from "../theme.js";

export interface LogTailProps extends Pick<ScreenProps, "narrow"> {
  readonly lines: readonly string[];
  readonly maxLines?: number;
  readonly title?: string;
}

export function LogTail({ lines, maxLines = 8, narrow, title = "Log" }: LogTailProps) {
  const limit = Math.max(0, Math.floor(maxLines));
  const visible = limit === 0 ? [] : lines.slice(-limit);
  const hidden = lines.length - visible.length;

  return (
    <Box flexDirection="column">
      <Text bold color={theme.accent}>
        {title}
      </Text>
      {hidden > 0 ? <Text dimColor>... {hidden} lines hidden above</Text> : null}
      {visible.length === 0 ? (
        <Text dimColor>No output yet.</Text>
      ) : (
        visible.map((line, index) => (
          <Text key={`${index}-${line}`} wrap={narrow ? "wrap" : "truncate"}>
            {line}
          </Text>
        ))
      )}
    </Box>
  );
}
