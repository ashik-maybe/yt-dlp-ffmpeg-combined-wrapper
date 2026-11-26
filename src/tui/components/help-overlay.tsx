import { Box, Text, useInput } from "ink";
import type { ScreenProps } from "../types.js";
import { theme } from "../theme.js";

export interface HelpKey {
  readonly keys: string;
  readonly action: string;
}

/** Every key the TUI handles. */
export const HELP_KEYS: readonly HelpKey[] = [
  { keys: "up/down, j/k", action: "move selection" },
  { keys: "enter", action: "select or confirm" },
  { keys: "space", action: "toggle task" },
  { keys: "y", action: "confirm yes" },
  { keys: "n", action: "cancel no" },
  { keys: "r", action: "run plan" },
  { keys: "?", action: "toggle this help" },
  { keys: "esc", action: "close help or go back" },
  { keys: "q", action: "quit" },
];

export interface HelpOverlayProps extends Pick<ScreenProps, "narrow"> {
  readonly onClose: () => void;
}

export function HelpOverlay({ narrow, onClose }: HelpOverlayProps) {
  useInput((input, key) => {
    if (input === "?" || key.escape) onClose();
  });

  return (
    <Box flexDirection="column">
      <Text bold color={theme.accent}>
        Help - press ? or Esc to close
      </Text>
      {HELP_KEYS.map((entry) => (
        <Box
          key={entry.keys}
          flexDirection={narrow ? "column" : "row"}
          columnGap={narrow ? 0 : 2}
        >
          <Text color={theme.accent}>{entry.keys}</Text>
          <Text>{entry.action}</Text>
        </Box>
      ))}
    </Box>
  );
}
