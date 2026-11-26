import { readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";

const GIF = new URL("../../docs/images/demo.gif", import.meta.url);
const PNG = new URL("../../docs/images/picker.png", import.meta.url);
const README = new URL("../../README.md", import.meta.url);
const MAX_GIF_BYTES = 5 * 1024 * 1024;

describe("README demo images", () => {
  it("keeps the demo GIF under 5 MB", () => {
    const size = statSync(GIF).size;
    expect(size).toBeGreaterThan(0);
    expect(size).toBeLessThan(MAX_GIF_BYTES);
  });

  it("keeps the picker PNG non-empty", () => {
    expect(statSync(PNG).size).toBeGreaterThan(0);
  });

  it("references both images from the README", () => {
    const readme = readFileSync(README, "utf8");
    expect(readme).toContain("docs/images/demo.gif");
    expect(readme).toContain("docs/images/picker.png");
    expect(readme).toContain("## Demo");
  });
});
