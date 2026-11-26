import type { Recipe, Tool } from "../core/index.js";
import { allRecipes, loadRecipes } from "../data/index.js";
import type { TaskItem } from "../tui/types.js";

const CURATED: Readonly<Record<Tool, readonly string[]>> = {
  "yt-dlp": [
    "best-video",
    "audio-mp3",
    "list-formats",
    "subtitles-only",
    "playlist-range",
    "clip-by-section",
  ],
  ffmpeg: ["web-h264", "trim-copy", "extract-audio", "palette-gif", "crf-tuning", "loudnorm"],
};

const HINTS: Readonly<Record<string, string>> = {
  "best-video": "Best video and audio merged to MKV",
  "audio-mp3": "Extract audio as MP3 at best quality",
  "list-formats": "List every available format",
  "subtitles-only": "Write English subtitles without video",
  "playlist-range": "Download playlist items 1 to 10",
  "clip-by-section": "Download a one-minute clip",
  "video-1080p": "Best video up to 1080p merged to MKV",
  "video-720p": "Best video up to 720p merged to MKV",
  "video-mp4": "Best MP4 video with M4A audio",
  "audio-m4a": "Extract audio as M4A",
  "audio-opus": "Extract audio as Opus",
  "audio-flac": "Extract audio as FLAC",
  "playlist-mp3": "Download a playlist as MP3 files",
  "subtitles-embed": "Download video and embed English subtitles",
  "thumbnail-only": "Download the thumbnail as JPG",
  "metadata-json": "Write the metadata info JSON",
  "archive-download": "Skip videos already in the archive file",
  "live-from-start": "Download a live stream from the start",
  "private-cookies": "Use Firefox cookies for private video",
  "clip-mp3": "Download a 30-second audio clip",
  "list-subs": "List available subtitles",
  "web-h264": "H.264 MP4 with AAC audio for the web",
  "trim-copy": "Cut a clip without re-encoding",
  "extract-audio": "Extract audio as MP3",
  "palette-gif": "Make a GIF with a generated palette",
  "crf-tuning": "Re-encode at a fixed CRF value",
  loudnorm: "Normalize loudness to -16 LUFS",
  "web-h265": "Smaller HEVC MP4 with AAC audio",
  "webm-vp9": "VP9 WebM with Opus audio",
  "remux-mkv": "Move streams into Matroska without re-encoding",
  "extract-frame": "Save one frame as a JPEG image",
  "scale-1080p": "Scale to 1080p height and encode H.264",
  "concat-list": "Join clips from a concat list without re-encoding",
  "strip-metadata": "Remove all metadata without re-encoding",
  "audio-wav": "Convert audio to 48 kHz stereo WAV",
};

const TOOLS: readonly Tool[] = ["yt-dlp", "ffmpeg"];

function toTask(recipe: Recipe): TaskItem {
  return {
    id: recipe.id,
    tool: recipe.tool,
    label: recipe.name,
    hint: HINTS[recipe.id] ?? recipe.name,
  };
}

export function curatedTasks(): readonly TaskItem[] {
  const tasks: TaskItem[] = [];
  for (const tool of TOOLS) {
    const byId = new Map(loadRecipes(tool).map((recipe) => [recipe.id, recipe]));
    for (const id of CURATED[tool]) {
      const recipe = byId.get(id);
      if (recipe === undefined) {
        throw new Error(`missing curated recipe "${id}" for ${tool}`);
      }
      tasks.push(toTask(recipe));
    }
  }
  return tasks;
}

export function allTasks(): readonly TaskItem[] {
  return allRecipes().map(toTask);
}
