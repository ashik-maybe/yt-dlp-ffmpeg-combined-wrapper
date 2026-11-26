import { render, cleanup } from "ink-testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PipelinePlan, StepResult } from "../../src/core/index.js";
import { App } from "../../src/tui/app.js";
import type { PlanExecutor, RunRequest } from "../../src/tui/app.js";
import { APP_NAME } from "../../src/tui/theme.js";

afterEach(() => {
  cleanup();
});

const plan: PipelinePlan = {
  version: 1,
  id: "demo",
  name: "Demo plan",
  shell: "posix",
  vars: {
    url: "https://example.com/v",
    out: "out.mp4",
  },
  steps: [
    {
      id: "download",
      tool: "yt-dlp",
      recipeId: "best-video",
      args: [
        { kind: "flag", name: "no-playlist" },
        { kind: "value", name: "{{url}}" },
      ],
      outputs: ["{{out}}"],
    },
    {
      id: "transcode",
      tool: "ffmpeg",
      recipeId: "web-h264",
      args: [
        { kind: "option", name: "i", value: "{{out}}" },
        { kind: "value", name: "web.mp4" },
      ],
      outputs: ["web.mp4"],
    },
    {
      id: "cleanup",
      tool: "ffmpeg",
      recipeId: "clean-temp",
      args: [{ kind: "flag", name: "y" }],
    },
  ],
};

const okResults: readonly StepResult[] = plan.steps.map((step) => ({
  stepId: step.id,
  ok: true,
  findings: [],
}));

function tick(ms = 30): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("App", () => {
  it("shows the picker, chrome, and step 1 of 6", () => {
    const view = render(
      <App
        runEnabled={false}
        plan={plan}
        yes={false}
        force={false}
        unsafe={false}
        version="1.2.3"
      />,
    );
    const frame = view.lastFrame() ?? "";

    expect(frame).toContain(APP_NAME);
    expect(frame).toContain("v1.2.3");
    expect(frame).toContain("steps: 3");
    expect(frame).toContain("step 1 of 6");
    expect(frame).toContain("Common tasks");
    expect(frame).toContain("best-video");
    expect(frame).toContain("More tasks...");
    expect(frame).toContain("Up/Down move - Enter select - m more - ? help - q quit");
    expect(frame).not.toMatch(/[^\x00-\x7F]/);
  });

  it("opens More with m and returns with Escape", async () => {
    const view = render(
      <App runEnabled={false} plan={plan} yes={false} force={false} unsafe={false} />,
    );

    view.stdin.write("m");
    await vi.waitFor(() => expect(view.lastFrame() ?? "").toContain("More tasks"));
    expect(view.lastFrame() ?? "").toContain("step 2 of 6");
    expect(view.lastFrame() ?? "").toContain("3 matches");

    view.stdin.write("\u001B");
    await vi.waitFor(() => expect(view.lastFrame() ?? "").toContain("Common tasks"));
    expect(view.lastFrame() ?? "").toContain("step 1 of 6");
  });

  it("moves the picker selection with arrows and opens Review on Enter", async () => {
    const view = render(
      <App runEnabled={false} plan={plan} yes={false} force={false} unsafe={false} />,
    );

    view.stdin.write("\u001B[B");
    await tick();
    view.stdin.write("\r");

    await vi.waitFor(() => expect(view.lastFrame() ?? "").toContain("Review plan: 3 step(s)"));
    expect(view.lastFrame() ?? "").toContain("step 3 of 6");
    expect(view.lastFrame() ?? "").toContain("web-h264");
  });

  it("routes picker, review, confirm, and back with Escape", async () => {
    const view = render(
      <App runEnabled={false} plan={plan} yes={false} force={false} unsafe={false} />,
    );

    view.stdin.write("\r");
    await vi.waitFor(() => expect(view.lastFrame() ?? "").toContain("Review plan: 3 step(s)"));

    view.stdin.write("\r");
    await vi.waitFor(() => expect(view.lastFrame() ?? "").toContain("Confirm"));
    expect(view.lastFrame() ?? "").toContain("step 4 of 6");

    view.stdin.write("\u001B");
    await vi.waitFor(() => expect(view.lastFrame() ?? "").toContain("Review plan: 3 step(s)"));

    view.stdin.write("\u001B");
    await vi.waitFor(() => expect(view.lastFrame() ?? "").toContain("Common tasks"));
    expect(view.lastFrame() ?? "").toContain("step 1 of 6");
  });

  it("opens and closes help with ?", async () => {
    const view = render(
      <App runEnabled={false} plan={plan} yes={false} force={false} unsafe={false} />,
    );

    view.stdin.write("?");
    await vi.waitFor(() =>
      expect(view.lastFrame() ?? "").toContain("Help - press ? or Esc to close"),
    );
    expect(view.lastFrame() ?? "").toContain("move selection");
    expect(view.lastFrame() ?? "").toContain("step 1 of 6");

    view.stdin.write("?");
    await vi.waitFor(() =>
      expect(view.lastFrame() ?? "").not.toContain("Help - press ? or Esc to close"),
    );
    expect(view.lastFrame() ?? "").toContain("Common tasks");
  });

  it("quits with q, Escape at the root, and Ctrl+C", async () => {
    const onQuit = vi.fn();

    const qView = render(
      <App
        runEnabled={false}
        plan={plan}
        yes={false}
        force={false}
        unsafe={false}
        onQuit={onQuit}
      />,
    );
    qView.stdin.write("q");
    await vi.waitFor(() => expect(onQuit).toHaveBeenCalledTimes(1));
    qView.unmount();

    onQuit.mockClear();
    const escView = render(
      <App
        runEnabled={false}
        plan={plan}
        yes={false}
        force={false}
        unsafe={false}
        onQuit={onQuit}
      />,
    );
    escView.stdin.write("\u001B");
    await vi.waitFor(() => expect(onQuit).toHaveBeenCalledTimes(1));
    escView.unmount();

    onQuit.mockClear();
    const ctrlView = render(
      <App
        runEnabled={false}
        plan={plan}
        yes={false}
        force={false}
        unsafe={false}
        onQuit={onQuit}
      />,
    );
    ctrlView.stdin.write("\u0003");
    await vi.waitFor(() => expect(onQuit).toHaveBeenCalledTimes(1));
  });

  it("never executes without --run", async () => {
    const executor = vi.fn<PlanExecutor>(async () => okResults);
    const view = render(
      <App
        runEnabled={false}
        plan={plan}
        yes={false}
        force={false}
        unsafe={false}
        executor={executor}
      />,
    );

    view.stdin.write("\r");
    await vi.waitFor(() => expect(view.lastFrame() ?? "").toContain("Review plan: 3 step(s)"));

    view.stdin.write("r");
    await vi.waitFor(() =>
      expect(view.lastFrame() ?? "").toContain("Dry-run only. Restart with --run to execute."),
    );
    expect(executor).not.toHaveBeenCalled();

    view.stdin.write("\r");
    await vi.waitFor(() => expect(view.lastFrame() ?? "").toContain("Confirm"));

    view.stdin.write("a");
    await vi.waitFor(() =>
      expect(view.lastFrame() ?? "").toContain("Execution is off. Restart with --run."),
    );
    expect(executor).not.toHaveBeenCalled();
  });

  it("runs without a prompt when --yes is set and shows Progress then Summary", async () => {
    let finish: ((results: readonly StepResult[]) => void) | undefined;
    const executor = vi.fn(
      (_request: RunRequest) =>
        new Promise<readonly StepResult[]>((resolve) => {
          finish = resolve;
        }),
    );

    const view = render(
      <App runEnabled plan={plan} yes force={false} unsafe={false} executor={executor} />,
    );

    view.stdin.write("\r");
    await vi.waitFor(() => expect(view.lastFrame() ?? "").toContain("Review plan: 3 step(s)"));

    view.stdin.write("\r");
    await vi.waitFor(() => expect(view.lastFrame() ?? "").toContain("Progress"));
    expect(view.lastFrame() ?? "").toContain("step 5 of 6");
    expect(executor).toHaveBeenCalledTimes(1);
    expect(executor).toHaveBeenCalledWith({
      plan,
      unsafe: false,
      force: false,
      dryRun: false,
      signal: expect.any(AbortSignal),
    });

    finish?.(okResults);
    await vi.waitFor(() => expect(view.lastFrame() ?? "").toContain("Summary"), {
      timeout: 2000,
    });
    expect(view.lastFrame() ?? "").toContain("step 6 of 6");
    expect(view.lastFrame() ?? "").toContain("Result: ok");
    expect(view.lastFrame() ?? "").toContain("Verification: passed");
  });

  it("asks for confirmation when --yes is absent and approves with a", async () => {
    const executor = vi.fn(async () => okResults);
    const view = render(
      <App runEnabled plan={plan} yes={false} force={false} unsafe={false} executor={executor} />,
    );

    view.stdin.write("\r");
    await vi.waitFor(() => expect(view.lastFrame() ?? "").toContain("Review plan: 3 step(s)"));

    view.stdin.write("\r");
    await vi.waitFor(() => expect(view.lastFrame() ?? "").toContain("Confirm"));
    expect(executor).not.toHaveBeenCalled();

    view.stdin.write("a");
    await vi.waitFor(() => expect(view.lastFrame() ?? "").toContain("Summary"), {
      timeout: 2000,
    });
    expect(executor).toHaveBeenCalledTimes(1);
  });

  it("aborts a running plan with a and shows the Summary", async () => {
    const executor = vi.fn((_request: RunRequest) => new Promise<readonly StepResult[]>(() => {}));
    const view = render(
      <App runEnabled plan={plan} yes force={false} unsafe={false} executor={executor} />,
    );

    view.stdin.write("\r");
    await vi.waitFor(() => expect(view.lastFrame() ?? "").toContain("Review plan: 3 step(s)"));
    view.stdin.write("\r");
    await vi.waitFor(() => expect(view.lastFrame() ?? "").toContain("Progress"));

    view.stdin.write("a");
    await vi.waitFor(() => expect(view.lastFrame() ?? "").toContain("Summary"));
    expect(view.lastFrame() ?? "").toContain("Run aborted.");
    expect(view.lastFrame() ?? "").toContain("Result: failed");
  });

  it("uses the narrow layout when the terminal is narrow", () => {
    const view = render(
      <App runEnabled={false} plan={plan} yes={false} force={false} unsafe={false} columns={60} />,
    );
    const frame = view.lastFrame() ?? "";

    expect(frame).toContain("Common tasks");
    expect(frame).not.toContain("yt-dlp --no-playlist");
    expect(frame).toContain("m more");
    expect(frame).toContain("Enter select - m more - ? help - q quit");
    expect(frame).not.toMatch(/[^\x00-\x7F]/);
  });
});
