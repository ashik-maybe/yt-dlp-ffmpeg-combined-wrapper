import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const TUI_SRC = fileURLToPath(new URL("../../src/tui", import.meta.url));

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

describe("TUI source", () => {
  it("uses ASCII characters only", () => {
    const offenders = files(TUI_SRC).flatMap((path) => {
      const lines = readFileSync(path, "utf8").split("\n");
      return lines.flatMap((line, index) =>
        /[^\x00-\x7F]/.test(line) ? [`${path}:${index + 1}: ${line.trim()}`] : [],
      );
    });

    expect(offenders).toEqual([]);
  });
});
