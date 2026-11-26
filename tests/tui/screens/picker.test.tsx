import { describe, expect, it, vi } from "vitest";
import { render } from "ink-testing-library";
import { MORE_TASK_ID, Picker } from "../../../src/tui/screens/Picker.js";
import { More } from "../../../src/tui/screens/More.js";
import type { ScreenProps, TaskItem } from "../../../src/tui/types.js";

const tasks: readonly TaskItem[] = [
  { id: "best-video", tool: "yt-dlp", label: "Download video", hint: "Save the best video" },
  { id: "audio-mp3", tool: "yt-dlp", label: "Audio only", hint: "Save audio as MP3" },
  { id: "web-h264", tool: "ffmpeg", label: "Convert for web", hint: "MP4 file for browsers" },
  { id: "trim-copy", tool: "ffmpeg", label: "Trim a clip", hint: "Cut without re-encoding" },
  { id: "extract-audio", tool: "ffmpeg", label: "Extract audio", hint: "Save the sound" },
  { id: "palette-gif", tool: "ffmpeg", label: "Make a GIF", hint: "Short animated image" },
  { id: "bonus-task", tool: "ffmpeg", label: "Extra task", hint: "Only in More" },
];

function tick(ms = 30): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function baseProps(overrides: Partial<ScreenProps> = {}): ScreenProps {
  return {
    tasks,
    selectedId: "best-video",
    onSelect: () => {},
    onBack: () => {},
    narrow: false,
    version: "0.0.0-test",
    ...overrides,
  };
}

describe("Picker", () => {
  it("renders six common tasks plus a More tasks row", () => {
    const { lastFrame } = render(<Picker {...baseProps()} />);
    const frame = lastFrame() ?? "";

    expect(frame).toContain("Common tasks");
    expect(frame).toContain("1. Download video");
    expect(frame).toContain("6. Make a GIF");
    expect(frame).toContain("More tasks...");
    expect(frame).not.toContain("Extra task");
  });

  it("marks the selected row", () => {
    const { lastFrame } = render(<Picker {...baseProps({ selectedId: "web-h264" })} />);
    const frame = lastFrame() ?? "";

    expect(frame).toContain("> 3. Convert for web");
    expect(frame).not.toContain("> 1. Download video");
  });

  it("moves the marker with arrows", async () => {
    const { lastFrame, stdin } = render(<Picker {...baseProps()} />);

    stdin.write("\u001B[B");
    await tick();
    expect(lastFrame() ?? "").toContain("> 2. Audio only");

    stdin.write("\u001B[A");
    await tick();
    expect(lastFrame() ?? "").toContain("> 1. Download video");
  });

  it("selects the highlighted task on Enter", async () => {
    const onSelect = vi.fn();
    const { stdin } = render(<Picker {...baseProps({ onSelect })} />);

    stdin.write("\u001B[B");
    await tick();
    stdin.write("\r");
    await tick();

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("audio-mp3");
  });

  it("selects the More tasks row on Enter", async () => {
    const onSelect = vi.fn();
    const { lastFrame, stdin } = render(<Picker {...baseProps({ onSelect })} />);

    for (let step = 0; step < 6; step += 1) {
      stdin.write("\u001B[B");
      await tick(10);
    }

    expect(lastFrame() ?? "").toContain("> More tasks...");
    stdin.write("\r");
    await tick();
    expect(onSelect).toHaveBeenCalledWith(MORE_TASK_ID);
  });
});

describe("More", () => {
  it("shows every task and the match count", () => {
    const { lastFrame } = render(<More {...baseProps()} />);
    const frame = lastFrame() ?? "";

    expect(frame).toContain("7 matches");
    expect(frame).toContain("Extra task");
    expect(frame).toContain("> 1. Download video");
  });

  it("searches by label", async () => {
    const { lastFrame, stdin } = render(<More {...baseProps()} />);

    stdin.write("audio");
    await tick();

    const frame = lastFrame() ?? "";
    expect(frame).toContain("Search: audio");
    expect(frame).toContain("2 matches");
    expect(frame).toContain("Audio only");
    expect(frame).toContain("Extract audio");
    expect(frame).not.toContain("Download video");
  });

  it("searches by id", async () => {
    const { lastFrame, stdin } = render(<More {...baseProps()} />);

    stdin.write("palette");
    await tick();

    const frame = lastFrame() ?? "";
    expect(frame).toContain("1 matches");
    expect(frame).toContain("Make a GIF");
    expect(frame).not.toContain("Extra task");
    expect(frame).not.toContain("Download video");
  });

  it("shows zero matches", async () => {
    const { lastFrame, stdin } = render(<More {...baseProps()} />);

    stdin.write("zzz");
    await tick();

    const frame = lastFrame() ?? "";
    expect(frame).toContain("0 matches");
    expect(frame).toContain("No matches");
  });

  it("selects a filtered task with arrows and Enter", async () => {
    const onSelect = vi.fn();
    const { lastFrame, stdin } = render(<More {...baseProps({ onSelect })} />);

    stdin.write("audio");
    await tick();
    stdin.write("\u001B[B");
    await tick();
    expect(lastFrame() ?? "").toContain("> 2. Extract audio");

    stdin.write("\r");
    await tick();
    expect(onSelect).toHaveBeenCalledWith("extract-audio");
  });

  it("goes back on Escape", async () => {
    const onBack = vi.fn();
    const { stdin } = render(<More {...baseProps({ onBack })} />);

    stdin.write("\u001B");
    await tick();

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
