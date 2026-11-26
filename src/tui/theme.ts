import type { StepStatus } from "./types.js";

export const APP_NAME = "yt-dlp-ffmpeg-combined-wrapper";
export const ACCENT = "cyan";
export const NARROW_MAX_COLUMNS = 80;

/** The TUI uses one accent color only. */
export const theme = {
  accent: ACCENT,
} as const;

const STATUS_MARKS: Readonly<Record<StepStatus, string>> = {
  pending: "[ ]",
  running: "[>]",
  ok: "[+]",
  failed: "[x]",
  skipped: "[-]",
};

export function statusMark(status: StepStatus): string {
  return STATUS_MARKS[status];
}

/** True when the terminal is too narrow for a single-line layout. */
export function isNarrow(columns: number): boolean {
  return columns < NARROW_MAX_COLUMNS;
}
