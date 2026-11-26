import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";
import { LogTail } from "../../../src/tui/components/index.js";

describe("LogTail", () => {
  it("keeps only the last lines and reports hidden lines", () => {
    const view = render(
      <LogTail lines={["alpha", "bravo", "charlie", "delta"]} maxLines={2} narrow={false} />,
    );
    const frame = view.lastFrame() ?? "";

    expect(frame).toContain("2 lines hidden above");
    expect(frame).toContain("charlie");
    expect(frame).toContain("delta");
    expect(frame).not.toContain("alpha");
    expect(frame).not.toContain("bravo");

    view.unmount();
  });

  it("uses a custom title and shows every line that fits", () => {
    const view = render(
      <LogTail
        lines={["ffmpeg version 8.0", "stream mapping"]}
        maxLines={8}
        narrow={false}
        title="Output"
      />,
    );
    const frame = view.lastFrame() ?? "";

    expect(frame).toContain("Output");
    expect(frame).toContain("ffmpeg version 8.0");
    expect(frame).toContain("stream mapping");
    expect(frame).not.toContain("hidden above");

    view.unmount();
  });

  it("shows an empty state when there are no lines", () => {
    const view = render(<LogTail lines={[]} narrow={false} />);
    const frame = view.lastFrame() ?? "";

    expect(frame).toContain("No output yet.");

    view.unmount();
  });
});
