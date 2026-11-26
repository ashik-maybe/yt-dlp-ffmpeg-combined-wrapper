import type { ToolAdapter } from "../contracts/index.js";
import type { Tool } from "../core/index.js";
import { ffmpegAdapter } from "./ffmpeg/index.js";
import { ytDlpAdapter } from "./yt-dlp/index.js";

export { ffmpegAdapter, ytDlpAdapter };

export const plannerAdapters: Readonly<Record<Tool, ToolAdapter>> = {
  "yt-dlp": ytDlpAdapter,
  ffmpeg: ffmpegAdapter,
};

export function adapterFor(tool: Tool): ToolAdapter {
  return plannerAdapters[tool];
}
