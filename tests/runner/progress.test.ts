import { describe, expect, it } from "vitest";
import { parseProgressLine } from "../../src/runner/progress.js";

describe("parseProgressLine", () => {
  describe("yt-dlp", () => {
    it("parses percent, speed and ETA", () => {
      const line = "[download]  45.6% of  100.00MiB at  1.50MiB/s ETA 00:32";
      expect(parseProgressLine(line, "yt-dlp")).toEqual({
        percent: 45.6,
        speed: "1.50MiB/s",
        time: "00:32",
      });
    });

    it("parses a completed download with elapsed time", () => {
      const line = "[download] 100% of 12.34MiB in 00:00:10 at 1.23MiB/s";
      expect(parseProgressLine(line, "yt-dlp")).toEqual({
        percent: 100,
        speed: "1.23MiB/s",
        time: "00:00:10",
      });
    });

    it("keeps a zero percent", () => {
      const line = "[download]   0.0% of 1.00MiB at Unknown";
      expect(parseProgressLine(line, "yt-dlp")).toEqual({ percent: 0 });
    });

    it("parses percent without speed or time", () => {
      const line = "[download]   7.5% of 1.00GiB";
      expect(parseProgressLine(line, "yt-dlp")).toEqual({ percent: 7.5 });
    });

    it("ignores non-download lines", () => {
      expect(parseProgressLine("[youtube] abc123: Downloading webpage", "yt-dlp")).toBeNull();
    });

    it("returns null for a download line without numbers", () => {
      expect(parseProgressLine("[download] Destination: video.mp4", "yt-dlp")).toBeNull();
    });
  });

  describe("ffmpeg", () => {
    it("parses time and speed from a stats line", () => {
      const line =
        "frame= 1234 fps= 25 q=28.0 size=  12345kB time=00:00:49.36 bitrate=2048.1kbits/s speed=1.01x";
      expect(parseProgressLine(line, "ffmpeg")).toEqual({
        time: "00:00:49.36",
        speed: "1.01x",
      });
    });

    it("converts out_time_ms to a timestamp", () => {
      expect(parseProgressLine("out_time_ms=49360000", "ffmpeg")).toEqual({
        time: "00:00:49.360",
      });
    });

    it("keeps zero out_time_ms", () => {
      expect(parseProgressLine("out_time_ms=0", "ffmpeg")).toEqual({ time: "00:00:00.000" });
    });

    it("parses time without speed", () => {
      expect(parseProgressLine("time=01:02:03.50", "ffmpeg")).toEqual({ time: "01:02:03.50" });
    });

    it("parses a speed-only progress line", () => {
      expect(parseProgressLine("speed=1.50x", "ffmpeg")).toEqual({ speed: "1.50x" });
    });

    it("ignores non-progress log lines", () => {
      expect(parseProgressLine("ffmpeg version 7.1 Copyright (c) 2000-2024", "ffmpeg")).toBeNull();
    });

    it("returns null for an unavailable time", () => {
      expect(parseProgressLine("time=N/A", "ffmpeg")).toBeNull();
    });

    it("returns null for a malformed out_time_ms", () => {
      expect(parseProgressLine("out_time_ms=not-a-number", "ffmpeg")).toBeNull();
    });
  });

  describe("empty input", () => {
    it("returns null for an empty line", () => {
      expect(parseProgressLine("", "yt-dlp")).toBeNull();
      expect(parseProgressLine("", "ffmpeg")).toBeNull();
    });

    it("returns null for a whitespace-only line", () => {
      expect(parseProgressLine("   ", "yt-dlp")).toBeNull();
      expect(parseProgressLine("\t", "ffmpeg")).toBeNull();
    });
  });
});
