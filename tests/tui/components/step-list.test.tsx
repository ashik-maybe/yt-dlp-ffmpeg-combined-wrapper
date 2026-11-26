import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";
import { StepList } from "../../../src/tui/components/index.js";
import type { StepView } from "../../../src/tui/types.js";

const steps: readonly StepView[] = [
  {
    id: "download",
    tool: "yt-dlp",
    label: "Download video",
    command: "yt-dlp https://example.com/video",
    status: "ok",
  },
  {
    id: "transcode",
    tool: "ffmpeg",
    label: "Transcode video",
    command: "ffmpeg -i in.mp4 out.mp4",
    status: "running",
  },
];

describe("StepList", () => {
  it("shows the title, count, status marks, tools, and commands", () => {
    const view = render(<StepList steps={steps} selectedId="transcode" narrow={false} />);
    const frame = view.lastFrame() ?? "";

    expect(frame).toContain("Steps (2)");
    expect(frame).toContain("Download video [yt-dlp]");
    expect(frame).toContain("[+]");
    expect(frame).toContain("> 2. [>] Transcode video [ffmpeg]");
    expect(frame).toContain("ffmpeg -i in.mp4 out.mp4");

    view.unmount();
  });

  it("hides commands in the narrow layout", () => {
    const view = render(<StepList steps={steps} selectedId="download" narrow />);
    const frame = view.lastFrame() ?? "";

    expect(frame).toContain("Download video [yt-dlp]");
    expect(frame).not.toContain("yt-dlp https://example.com/video");
    expect(frame).not.toContain("ffmpeg -i in.mp4 out.mp4");

    view.unmount();
  });

  it("shows an empty state when no steps exist", () => {
    const view = render(<StepList steps={[]} narrow={false} />);
    const frame = view.lastFrame() ?? "";

    expect(frame).toContain("Steps (0)");
    expect(frame).toContain("No steps.");

    view.unmount();
  });
});
