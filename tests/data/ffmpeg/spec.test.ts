import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SPEC_DIR, array, jsonNames, readJson, record, text } from "./helpers.js";

const ARG_KINDS = ["flag", "option", "value"];
const MEDIA = ["video", "audio"];

function load(name: string): Record<string, unknown> {
  return record(readJson(join(SPEC_DIR, name)), name);
}

describe("ffmpeg spec data", () => {
  const names = jsonNames(SPEC_DIR);

  it("contains the expected spec files", () => {
    expect(names).toEqual([
      "encoders.json",
      "filters.json",
      "manifest.json",
      "options.json",
      "version.json",
    ]);
  });

  it("parses every spec JSON file", () => {
    for (const name of names) {
      expect(() => readJson(join(SPEC_DIR, name)), name).not.toThrow();
    }
  });

  it("pins one ffmpeg version", () => {
    const version = load("version.json");
    expect(version.schema).toBe(1);
    expect(version.tool).toBe("ffmpeg");
    expect(version.pinned).toBe(true);
    expect(version.codename).toBe("Hoare");
    expect(text(version.version, "version")).toMatch(/^\d+\.\d+(?:\.\d+)?$/);
    expect(text(version.released, "released")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(text(version.source, "source")).toBe("https://ffmpeg.org/download.html#release_8.1");
  });

  it("links every spec file from the manifest", () => {
    const manifest = load("manifest.json");
    expect(manifest.schema).toBe(1);
    expect(manifest.tool).toBe("ffmpeg");
    expect(manifest.version).toBe(text(load("version.json").version, "version"));
    const files = record(manifest.files, "manifest.files");
    for (const key of ["version", "options", "filters", "encoders"]) {
      const file = text(files[key], `manifest.files.${key}`);
      expect(names, key).toContain(file);
    }
  });

  it("defines unique options with PlanArg fields", () => {
    const spec = load("options.json");
    expect(spec.schema).toBe(1);
    expect(spec.tool).toBe("ffmpeg");
    expect(spec.kind).toBe("options");
    const items = array(spec.items, "options.items");
    expect(items.length).toBeGreaterThanOrEqual(30);
    const seen = new Set<string>();
    items.forEach((raw, index) => {
      const label = `options.items[${index}]`;
      const item = record(raw, label);
      const kind = text(item.kind, `${label}.kind`);
      expect(ARG_KINDS, label).toContain(kind);
      const name = text(item.name, `${label}.name`);
      expect(name, label).toMatch(/^-[A-Za-z]/);
      expect(seen.has(name), name).toBe(false);
      seen.add(name);
      expect(text(item.summary, `${name} summary`).length, name).toBeGreaterThan(0);
      if (kind === "option") {
        expect(typeof item.value, name).toBe("string");
      } else if (kind === "flag") {
        expect(item.value, name).toBeUndefined();
      }
    });
    expect(seen.size).toBe(items.length);
  });

  it("defines unique filters as value args", () => {
    const spec = load("filters.json");
    expect(spec.schema).toBe(1);
    expect(spec.tool).toBe("ffmpeg");
    expect(spec.kind).toBe("filters");
    const items = array(spec.items, "filters.items");
    expect(items.length).toBeGreaterThanOrEqual(12);
    const seen = new Set<string>();
    items.forEach((raw, index) => {
      const label = `filters.items[${index}]`;
      const item = record(raw, label);
      expect(item.kind, label).toBe("value");
      const name = text(item.name, `${label}.name`);
      const value = text(item.value, `${label}.value`);
      expect(name, label).toMatch(/^[a-z][a-z0-9_]*$/);
      expect(value.startsWith(name), name).toBe(true);
      expect(MEDIA, name).toContain(item.media);
      expect(seen.has(name), name).toBe(false);
      seen.add(name);
      expect(text(item.summary, `${name} summary`).length, name).toBeGreaterThan(0);
    });
    for (const name of ["scale", "palettegen", "paletteuse", "loudnorm"]) {
      expect(seen.has(name), name).toBe(true);
    }
  });

  it("defines unique encoders", () => {
    const spec = load("encoders.json");
    expect(spec.schema).toBe(1);
    expect(spec.tool).toBe("ffmpeg");
    expect(spec.kind).toBe("encoders");
    const items = array(spec.items, "encoders.items");
    expect(items.length).toBeGreaterThanOrEqual(8);
    const seen = new Set<string>();
    items.forEach((raw, index) => {
      const label = `encoders.items[${index}]`;
      const item = record(raw, label);
      expect(item.kind, label).toBe("value");
      const name = text(item.name, `${label}.name`);
      expect(seen.has(name), name).toBe(false);
      seen.add(name);
      text(item.value, `${label}.value`);
      expect(MEDIA, name).toContain(item.media);
      expect(typeof item.lossy, name).toBe("boolean");
      expect(text(item.summary, `${name} summary`).length, name).toBeGreaterThan(0);
    });
    expect(seen.size).toBe(items.length);
  });
});
