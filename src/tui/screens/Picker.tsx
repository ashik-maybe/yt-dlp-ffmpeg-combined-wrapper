import { useState } from "react";
import { Box, Text, useInput } from "ink";
import type { ScreenProps } from "../types.js";

/** Sentinel id for the More tasks row. */
export const MORE_TASK_ID = "__more__";

const COMMON_LIMIT = 6;

/** Show the six common tasks plus a More tasks row. */
export function Picker({ tasks, selectedId, onSelect, narrow, version }: ScreenProps) {
  const common = tasks.slice(0, COMMON_LIMIT);
  const rowCount = common.length + 1;
  const [index, setIndex] = useState(() => {
    const found = common.findIndex((task) => task.id === selectedId);
    return found === -1 ? 0 : found;
  });
  const safeIndex = Math.min(index, rowCount - 1);
  const onMoreRow = safeIndex === common.length;

  useInput((_input, key) => {
    if (rowCount === 0) return;
    if (key.upArrow) {
      setIndex((current) => (current - 1 + rowCount) % rowCount);
      return;
    }
    if (key.downArrow) {
      setIndex((current) => (current + 1) % rowCount);
      return;
    }
    if (key.return) {
      if (onMoreRow) {
        onSelect(MORE_TASK_ID);
        return;
      }
      const task = common[safeIndex];
      if (task) onSelect(task.id);
    }
  });

  return (
    <Box flexDirection="column">
      <Box>
        <Text bold>Common tasks</Text>
        {version !== "" ? <Text dimColor> {version}</Text> : null}
      </Box>
      <Box flexDirection="column" marginTop={1}>
        {common.map((task, taskIndex) => {
          const selected = taskIndex === safeIndex;
          return (
            <Text key={task.id}>
              <Text>{selected ? ">" : " "}</Text> {taskIndex + 1}. {task.label}
              {narrow ? null : <Text dimColor> - {task.hint}</Text>}
            </Text>
          );
        })}
        <Text>
          <Text>{onMoreRow ? ">" : " "}</Text> More tasks...
        </Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          Up/Down move Enter select
          {narrow ? "" : "  More tasks: search all"}
        </Text>
      </Box>
    </Box>
  );
}
