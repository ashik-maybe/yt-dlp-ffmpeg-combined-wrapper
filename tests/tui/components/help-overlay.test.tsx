import { render } from "ink-testing-library";
import { describe, expect, it, vi } from "vitest";
import { HELP_KEYS, HelpOverlay } from "../../../src/tui/components/index.js";

const flush = () => new Promise((resolve) => setTimeout(resolve, 20));

describe("HelpOverlay", () => {
  it("lists every handled key", () => {
    const view = render(<HelpOverlay narrow={false} onClose={() => {}} />);
    const frame = view.lastFrame() ?? "";

    for (const entry of HELP_KEYS) {
      expect(frame).toContain(entry.keys);
      expect(frame).toContain(entry.action);
    }

    view.unmount();
  });

  it("closes on a question mark", async () => {
    const onClose = vi.fn();
    const view = render(<HelpOverlay narrow={false} onClose={onClose} />);

    view.stdin.write("?");
    await flush();

    expect(onClose).toHaveBeenCalledTimes(1);
    view.unmount();
  });

  it("closes on Escape", async () => {
    const onClose = vi.fn();
    const view = render(<HelpOverlay narrow={false} onClose={onClose} />);

    view.stdin.write("\u001B");
    await flush();

    expect(onClose).toHaveBeenCalledTimes(1);
    view.unmount();
  });
});
