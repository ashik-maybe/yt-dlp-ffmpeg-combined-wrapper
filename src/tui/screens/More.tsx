import { useMemo, useState } from "react";
import { Box, Text, useInput } from "ink";
import type { ScreenProps, TaskItem } from "../types.js";

function matches(task: TaskItem, query: string): boolean {
  return task.label.toLowerCase().includes(query) || task.id.toLowerCase().includes(query);
}

/** Search every task by label or id. */
export function More({ tasks, selectedId, onSelect, onBack, narrow, version }: ScreenProps) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === "") return tasks;
    return tasks.filter((task) => matches(task, q));
  }, [tasks, query]);
  const [index, setIndex] = useState(() => {
    const found = tasks.findIndex((task) => task.id === selectedId);
    return found === -1 ? 0 : found;
  });
  const safeIndex = filtered.length === 0 ? 0 : Math.min(index, filtered.length - 1);

  useInput((input, key) => {
    if (key.escape) {
      onBack();
      return;
    }
    if (key.upArrow) {
      if (filtered.length === 0) return;
      setIndex((safeIndex - 1 + filtered.length) % filtered.length);
      return;
    }
    if (key.downArrow) {
      if (filtered.length === 0) return;
      setIndex((safeIndex + 1) % filtered.length);
      return;
    }
    if (key.return) {
      const task = filtered[safeIndex];
      if (task) onSelect(task.id);
      return;
    }
    if (key.backspace || key.delete) {
      setQuery((current) => current.slice(0, -1));
      setIndex(0);
      return;
    }
    if (key.tab || key.ctrl || key.meta || key.leftArrow || key.rightArrow) return;
    if (input && input !== "?") {
      setQuery((current) => current + input);
      setIndex(0);
    }
  });

  return (
    <Box flexDirection="column">
      <Box>
        <Text bold>More tasks</Text>
        {version !== "" ? <Text dimColor> {version}</Text> : null}
      </Box>
      <Box flexDirection="column" marginTop={1}>
        <Text>Search: {query === "" ? "-" : query}</Text>
        <Text dimColor>{filtered.length} matches</Text>
        <Box flexDirection="column" marginTop={1}>
          {filtered.map((task, taskIndex) => {
            const selected = taskIndex === safeIndex;
            return (
              <Text key={task.id}>
                <Text>{selected ? ">" : " "}</Text> {taskIndex + 1}. {task.label}
                {narrow ? null : <Text dimColor> - {task.hint}</Text>}
              </Text>
            );
          })}
          {filtered.length === 0 ? <Text dimColor>No matches</Text> : null}
        </Box>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Type to search  Up/Down move  Enter select  Esc back</Text>
      </Box>
    </Box>
  );
}
