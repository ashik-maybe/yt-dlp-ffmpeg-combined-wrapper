import type { Tool } from "../core/index.js";

export interface Progress {
  readonly percent?: number;
  readonly speed?: string;
  readonly time?: string;
}

const YT_PERCENT_RE = /(\d+(?:\.\d+)?)%/;
const YT_SPEED_RE = /\bat\s+([\d.]+\s*[KMGTPE]?i?B\/s)/i;
const YT_TIME_RE = /\b(?:ETA|in)\s+(\d+:\d{2}(?::\d{2})?)/i;

const FFMPEG_TIME_RE = /\btime=(\d+:\d{2}:\d{2}(?:\.\d+)?)/;
const FFMPEG_OUT_TIME_MS_RE = /\bout_time_ms=(\d+)/;
const FFMPEG_SPEED_RE = /\bspeed=\s*([\d.]+x)/;

/** Format a microsecond count as HH:MM:SS.mmm. */
function formatMicroseconds(microseconds: number): string {
  const totalMs = Math.round(microseconds / 1000);
  const ms = totalMs % 1000;
  const totalSeconds = Math.floor(totalMs / 1000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  return [
    String(hours).padStart(2, "0"),
    String(minutes).padStart(2, "0"),
    String(seconds).padStart(2, "0"),
  ].join(":") + `.${String(ms).padStart(3, "0")}`;
}

function parseYtDlp(line: string): Progress | null {
  if (!line.includes("[download]")) return null;

  const percent = YT_PERCENT_RE.exec(line);
  const speed = YT_SPEED_RE.exec(line);
  const time = YT_TIME_RE.exec(line);
  if (!percent && !speed && !time) return null;

  const progress: { percent?: number; speed?: string; time?: string } = {};
  if (percent) progress.percent = Number.parseFloat(percent[1]);
  if (speed) progress.speed = speed[1];
  if (time) progress.time = time[1];
  return progress;
}

function parseFfmpeg(line: string): Progress | null {
  const time = FFMPEG_TIME_RE.exec(line);
  const outTimeMs = FFMPEG_OUT_TIME_MS_RE.exec(line);
  const speed = FFMPEG_SPEED_RE.exec(line);
  if (!time && !outTimeMs && !speed) return null;

  const progress: { percent?: number; speed?: string; time?: string } = {};
  if (time) progress.time = time[1];
  else if (outTimeMs) progress.time = formatMicroseconds(Number.parseInt(outTimeMs[1], 10));
  if (speed) progress.speed = speed[1];
  return progress;
}

/**
 * Parse one progress line from a tool.
 * Returns null when the line carries no progress data.
 */
export function parseProgressLine(line: string, tool: Tool): Progress | null {
  if (line.trim() === "") return null;
  if (tool === "yt-dlp") return parseYtDlp(line);
  if (tool === "ffmpeg") return parseFfmpeg(line);
  return null;
}
