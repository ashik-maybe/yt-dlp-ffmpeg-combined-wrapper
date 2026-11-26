import { describe, expect, it } from "vitest";
import { loadJsonDir, readJson } from "./load.js";

type JsonObject = Record<string, unknown>;

const VERSION_PATH = "src/spec/yt-dlp/version.json";
const OPTIONS_PATH = "src/spec/yt-dlp/options.json";

const OPTION_KEYS = new Set(["name", "alias", "kind", "value", "category", "description"]);
const OPTION_KINDS = new Set(["flag", "option"]);
const REQUIRED_OPTIONS = [
  "--format",
  "--output",
  "--extract-audio",
  "--list-formats",
  "--playlist-items",
  "--download-sections",
  "--write-subs",
  "--sub-langs",
  "--cookies-from-browser",
];

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asObject(value: unknown, label: string): JsonObject {
  expect(isObject(value), `${label} must be an object`).toBe(true);
  return value as JsonObject;
}

function asArray(value: unknown, label: string): readonly unknown[] {
  expect(Array.isArray(value), `${label} must be an array`).toBe(true);
  return value as readonly unknown[];
}

function asString(value: unknown, label: string): string {
  expect(typeof value, `${label} must be a string`).toBe("string");
  return value as string;
}

describe("yt-dlp spec files", () => {
  it("parses every JSON file in src/spec/yt-dlp", () => {
    const files = loadJsonDir("src/spec/yt-dlp");
    expect(files.length).toBeGreaterThanOrEqual(2);
    for (const file of files) {
      expect(isObject(file.data), `${file.file} must hold an object`).toBe(true);
    }
  });

  it("pins one yt-dlp version", () => {
    const version = asObject(readJson(VERSION_PATH), "version spec");
    expect(version.tool).toBe("yt-dlp");
    expect(asString(version.version, "version")).toMatch(/^\d{4}\.\d{2}\.\d{2}$/);
    expect(version.channel).toBe("stable");
    expect(version.confidence).toBe("verified");
    expect(asString(version.checkedAt, "checkedAt")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(version.source).toBe(
      `https://github.com/yt-dlp/yt-dlp/releases/tag/${String(version.version)}`,
    );
  });

  it("matches the version spec in the options spec", () => {
    const version = asObject(readJson(VERSION_PATH), "version spec");
    const optionsDoc = asObject(readJson(OPTIONS_PATH), "options spec");
    expect(optionsDoc.tool).toBe("yt-dlp");
    expect(optionsDoc.version).toBe(version.version);
    expect(asString(optionsDoc.docs, "docs")).toContain(String(version.version));
  });
});

describe("yt-dlp option spec", () => {
  const doc = asObject(readJson(OPTIONS_PATH), "options spec");
  const options = asArray(doc.options, "options");

  it("lists options and flags", () => {
    expect(options.length).toBeGreaterThanOrEqual(20);
    const kinds = new Set(options.map((option) => asObject(option, "option").kind));
    expect(kinds).toEqual(new Set(["flag", "option"]));
  });

  it("uses unique long names and short aliases", () => {
    const names = new Set<string>();
    const aliases = new Set<string>();
    for (const entry of options) {
      const option = asObject(entry, "option");
      const name = asString(option.name, "option name");
      expect(name.startsWith("--"), `${name} must be a long option`).toBe(true);
      expect(names.has(name), `${name} is duplicated`).toBe(false);
      names.add(name);
      if (option.alias !== undefined) {
        const alias = asString(option.alias, `${name} alias`);
        expect(alias.startsWith("-"), `${alias} must start with a dash`).toBe(true);
        expect(alias.startsWith("--"), `${alias} must be short`).toBe(false);
        expect(aliases.has(alias), `${alias} is duplicated`).toBe(false);
        aliases.add(alias);
      }
    }
  });

  it("gives every option a valid shape", () => {
    for (const entry of options) {
      const option = asObject(entry, "option");
      const name = asString(option.name, "option name");
      for (const key of Object.keys(option)) {
        expect(OPTION_KEYS.has(key), `${name} has unknown key "${key}"`).toBe(true);
      }
      expect(OPTION_KINDS.has(String(option.kind)), `${name} has a bad kind`).toBe(true);
      expect(asString(option.category, `${name} category`).length).toBeGreaterThan(0);
      expect(asString(option.description, `${name} description`).length).toBeGreaterThan(0);
      if (option.kind === "flag") {
        expect(option.value, `${name} is a flag and must not take a value`).toBeUndefined();
      } else {
        expect(asString(option.value, `${name} value`).length).toBeGreaterThan(0);
      }
    }
  });

  it("covers the options used by the recipes", () => {
    const names = new Set(options.map((entry) => asString(asObject(entry, "option").name, "name")));
    for (const required of REQUIRED_OPTIONS) {
      expect(names.has(required), `${required} is missing`).toBe(true);
    }
  });
});
