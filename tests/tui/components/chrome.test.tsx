import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";
import { Chrome } from "../../../src/tui/components/index.js";
import { APP_NAME } from "../../../src/tui/theme.js";

describe("Chrome", () => {
  it("shows the app name, version, and step count", () => {
    const view = render(<Chrome version="1.2.3" stepCount={4} narrow={false} />);
    const frame = view.lastFrame() ?? "";

    expect(frame).toContain(APP_NAME);
    expect(frame).toContain("v1.2.3");
    expect(frame).toContain("steps: 4");

    view.unmount();
  });

  it("keeps every field in the narrow layout", () => {
    const view = render(<Chrome version="0.9.0" stepCount={2} narrow />);
    const frame = view.lastFrame() ?? "";

    expect(frame).toContain(APP_NAME);
    expect(frame).toContain("v0.9.0");
    expect(frame).toContain("steps: 2");

    view.unmount();
  });
});
