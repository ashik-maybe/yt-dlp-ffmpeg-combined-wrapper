import { describe, expect, it } from "vitest";
import { isNarrow, NARROW_MAX_COLUMNS, statusMark } from "../../../src/tui/theme.js";

describe("theme", () => {
  it("marks a terminal narrow below the breakpoint", () => {
    expect(isNarrow(NARROW_MAX_COLUMNS - 1)).toBe(true);
    expect(isNarrow(NARROW_MAX_COLUMNS)).toBe(false);
    expect(isNarrow(NARROW_MAX_COLUMNS + 1)).toBe(false);
  });

  it("uses ASCII status marks", () => {
    for (const mark of [
      statusMark("pending"),
      statusMark("running"),
      statusMark("ok"),
      statusMark("failed"),
      statusMark("skipped"),
    ]) {
      expect(mark).toMatch(/^\[[ >+x-]\]$/);
    }
  });
});
