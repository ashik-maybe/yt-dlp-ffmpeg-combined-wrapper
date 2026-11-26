import { render, cleanup } from "ink-testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Finding } from "../../../src/core/index.js";
import { Confirm } from "../../../src/tui/screens/Confirm.js";
import { Review } from "../../../src/tui/screens/Review.js";
import type { ScreenProps, StepView } from "../../../src/tui/types.js";

afterEach(() => {
  cleanup();
});

const steps: readonly StepView[] = [
  {
    id: "s1",
    tool: "yt-dlp",
    label: "Download",
    command: "yt-dlp -f best https://example.com/v",
    status: "pending",
  },
  {
    id: "s2",
    tool: "ffmpeg",
    label: "Transcode",
    command: "ffmpeg -i in.webm out.mp4",
    status: "pending",
  },
];

const findings: readonly Finding[] = [
  {
    severity: "error",
    code: "E_UNSAFE",
    message: "step s2 requires unsafe mode",
    location: "step:s2",
  },
  {
    severity: "warning",
    code: "W_UNVERIFIED",
    message: "recipe is unverified",
    location: "step:s1",
  },
];

function screenProps(overrides: Partial<ScreenProps> = {}): ScreenProps {
  return {
    tasks: [],
    selectedId: "s1",
    onSelect: vi.fn(),
    onBack: vi.fn(),
    narrow: false,
    version: "1.2.3",
    ...overrides,
  };
}

describe("Review", () => {
  it("shows every step and its command", () => {
    const view = render(
      <Review {...screenProps()} steps={steps} findings={findings} onContinue={vi.fn()} />,
    );
    const frame = view.lastFrame() ?? "";

    expect(frame).toContain("Review plan: 2 step(s)");
    expect(frame).toContain("Download");
    expect(frame).toContain("yt-dlp -f best https://example.com/v");
    expect(frame).toContain("Transcode");
    expect(frame).toContain("ffmpeg -i in.webm out.mp4");
    expect(frame).toContain("v1.2.3");
  });

  it("shows guard findings", () => {
    const view = render(
      <Review {...screenProps()} steps={steps} findings={findings} onContinue={vi.fn()} />,
    );
    const frame = view.lastFrame() ?? "";

    expect(frame).toContain("Guard findings (2)");
    expect(frame).toContain("E_UNSAFE");
    expect(frame).toContain("step s2 requires unsafe mode");
    expect(frame).toContain("[step:s2]");
    expect(frame).toContain("W_UNVERIFIED");
    expect(frame).toContain("recipe is unverified");
  });

  it("moves the selection with arrow keys", () => {
    const props = screenProps();
    const view = render(<Review {...props} steps={steps} findings={[]} onContinue={vi.fn()} />);

    view.stdin.write("\u001B[B");
    expect(props.onSelect).toHaveBeenCalledWith("s2");

    view.rerender(
      <Review {...props} selectedId="s2" steps={steps} findings={[]} onContinue={vi.fn()} />,
    );
    view.stdin.write("\u001B[A");
    expect(props.onSelect).toHaveBeenLastCalledWith("s1");
  });

  it("continues on Enter and goes back on Escape", async () => {
    const props = screenProps();
    const onContinue = vi.fn();
    const view = render(
      <Review {...props} steps={steps} findings={[]} onContinue={onContinue} />,
    );

    view.stdin.write("\r");
    expect(onContinue).toHaveBeenCalledTimes(1);

    view.stdin.write("\u001B");
    await vi.waitFor(() => expect(props.onBack).toHaveBeenCalledTimes(1));
  });

  it("shows an empty state when there are no steps or findings", () => {
    const view = render(
      <Review {...screenProps()} steps={[]} findings={[]} onContinue={vi.fn()} />,
    );
    const frame = view.lastFrame() ?? "";

    expect(frame).toContain("No steps to review.");
    expect(frame).toContain("No guard findings.");
  });
});

describe("Confirm", () => {
  it("shows risky steps and confirms with y", () => {
    const props = screenProps();
    const onConfirm = vi.fn();
    const view = render(
      <Confirm {...props} steps={steps} findings={findings} onConfirm={onConfirm} />,
    );
    const frame = view.lastFrame() ?? "";

    expect(frame).toContain("Confirm 1 risky step(s)");
    expect(frame).toContain("Transcode");
    expect(frame).toContain("ffmpeg -i in.webm out.mp4");
    expect(frame).not.toContain("Download");
    expect(frame).toContain("E_UNSAFE: step s2 requires unsafe mode");

    view.stdin.write("y");
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("goes back on Escape", async () => {
    const props = screenProps();
    const onConfirm = vi.fn();
    const view = render(
      <Confirm {...props} steps={steps} findings={findings} onConfirm={onConfirm} />,
    );

    view.stdin.write("\u001B");
    await vi.waitFor(() => expect(props.onBack).toHaveBeenCalledTimes(1));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("shows no risky steps without errors", () => {
    const view = render(
      <Confirm {...screenProps()} steps={steps} findings={[]} onConfirm={vi.fn()} />,
    );
    const frame = view.lastFrame() ?? "";

    expect(frame).toContain("Confirm 0 risky step(s)");
    expect(frame).toContain("No risky steps.");
  });
});
