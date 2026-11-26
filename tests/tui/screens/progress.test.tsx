import { describe, expect, it, vi } from "vitest";
import { render } from "ink-testing-library";
import { Progress } from "../../../src/tui/screens/Progress.js";
import { Summary } from "../../../src/tui/screens/Summary.js";
import type { ScreenProps, StepStatus, StepView } from "../../../src/tui/types.js";

const baseProps: ScreenProps = {
  tasks: [],
  selectedId: "",
  onSelect: () => {},
  onBack: () => {},
  narrow: false,
  version: "1.2.3",
};

function step(
  id: string,
  label: string,
  status: StepStatus,
  tool: StepView["tool"] = "yt-dlp",
): StepView {
  return { id, tool, label, command: `${tool} ${id}`, status };
}

function tick(ms = 50): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("Progress", () => {
  it("shows the status of every step", () => {
    const { lastFrame } = render(
      <Progress
        {...baseProps}
        steps={[
          step("fetch", "Fetch source", "pending"),
          step("probe", "Probe media", "running"),
          step("remux", "Remux stream", "ok"),
          step("upload", "Upload result", "failed"),
          step("clean", "Clean temp", "skipped"),
        ]}
      />,
    );

    const frame = lastFrame() ?? "";
    expect(frame).toContain("[ ] Fetch source (pending)");
    expect(frame).toContain("[>] Probe media (running)");
    expect(frame).toContain("[x] Remux stream (ok)");
    expect(frame).toContain("[!] Upload result (failed)");
    expect(frame).toContain("[-] Clean temp (skipped)");
  });

  it("renders a progress bar with percent and counts", () => {
    const { lastFrame } = render(
      <Progress
        {...baseProps}
        steps={[
          step("a", "Step A", "ok"),
          step("b", "Step B", "ok"),
          step("c", "Step C", "pending"),
          step("d", "Step D", "pending"),
        ]}
      />,
    );

    const frame = lastFrame() ?? "";
    expect(frame).toContain("[##########----------]");
    expect(frame).toContain("50%");
    expect(frame).toContain("2/4 done");
  });

  it("narrows the bar on a narrow terminal", () => {
    const { lastFrame } = render(
      <Progress
        {...baseProps}
        narrow
        steps={[
          step("a", "Step A", "ok"),
          step("b", "Step B", "ok"),
          step("c", "Step C", "pending"),
          step("d", "Step D", "pending"),
        ]}
      />,
    );

    const frame = lastFrame() ?? "";
    expect(frame).toContain("[#####-----]");
    expect(frame).not.toContain("[##########----------]");
  });

  it("shows only the last non-empty log line", () => {
    const { lastFrame } = render(
      <Progress
        {...baseProps}
        steps={[step("a", "Step A", "running")]}
        logs={["starting run", "", "frame= 120 fps= 30"]}
      />,
    );

    const frame = lastFrame() ?? "";
    expect(frame).toContain("Last log:");
    expect(frame).toContain("frame= 120 fps= 30");
    expect(frame).not.toContain("starting run");
  });

  it("hides the last log line in the narrow layout but keeps the bar", () => {
    const { lastFrame } = render(
      <Progress
        {...baseProps}
        narrow
        steps={[
          step("a", "Step A", "ok"),
          step("b", "Step B", "ok"),
          step("c", "Step C", "pending"),
          step("d", "Step D", "pending"),
        ]}
        logs={["starting run", "", "frame= 120 fps= 30"]}
      />,
    );

    const frame = lastFrame() ?? "";
    expect(frame).toContain("Progress");
    expect(frame).toContain("[#####-----]");
    expect(frame).toContain("50%");
    expect(frame).toContain("2/4 done");
    expect(frame).not.toContain("Last log:");
    expect(frame).not.toContain("frame= 120 fps= 30");
    expect(frame).not.toContain("starting run");
  });

  it("reports when no log output exists yet", () => {
    const { lastFrame } = render(
      <Progress {...baseProps} steps={[step("a", "Step A", "pending")]} logs={[]} />,
    );

    expect(lastFrame() ?? "").toContain("No output yet.");
  });
});

describe("Summary", () => {
  it("shows an ok result when all steps pass", () => {
    const { lastFrame } = render(
      <Summary
        {...baseProps}
        steps={[step("a", "Step A", "ok"), step("b", "Step B", "skipped")]}
        verification="passed"
        verifyCommand="ffprobe out.mp4"
      />,
    );

    const frame = lastFrame() ?? "";
    expect(frame).toContain("Result: ok");
    expect(frame).toContain("Verification: passed");
    expect(frame).toContain("ffprobe out.mp4");
    expect(frame).toContain("Failed steps:");
    expect(frame).toContain("none");
  });

  it("lists failed steps and reports a failed result", () => {
    const { lastFrame } = render(
      <Summary
        {...baseProps}
        steps={[
          step("a", "Step A", "ok"),
          step("b", "Upload result", "failed", "yt-dlp"),
          step("c", "Remux", "failed", "ffmpeg"),
        ]}
        verification="skipped"
      />,
    );

    const frame = lastFrame() ?? "";
    expect(frame).toContain("Result: failed");
    expect(frame).toContain("[!] Upload result (yt-dlp)");
    expect(frame).toContain("[!] Remux (ffmpeg)");
    expect(frame).toContain("yt-dlp b");
    expect(frame).not.toContain("[!] Step A");
  });

  it("fails the result when verification fails", () => {
    const { lastFrame } = render(
      <Summary
        {...baseProps}
        steps={[step("a", "Step A", "ok")]}
        verification="failed"
        verifyCommand="test -f out.mp4"
      />,
    );

    const frame = lastFrame() ?? "";
    expect(frame).toContain("Result: failed");
    expect(frame).toContain("Verification: failed");
    expect(frame).toContain("test -f out.mp4");
  });

  it("calls onQuit when q is pressed", async () => {
    const onQuit = vi.fn();
    const { stdin } = render(
      <Summary
        {...baseProps}
        steps={[step("a", "Step A", "ok")]}
        verification="passed"
        onQuit={onQuit}
      />,
    );

    stdin.write("q");
    await tick();
    expect(onQuit).toHaveBeenCalledTimes(1);
  });
});
