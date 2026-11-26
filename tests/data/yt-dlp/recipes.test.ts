import { beforeAll, describe, expect, it } from "vitest";
import { renderCommand } from "../../../src/core/index.js";
import type { PlanArg, Recipe, Step } from "../../../src/core/index.js";
import { toolAdapters } from "../../../src/contracts/index.js";
import { loadJsonDir, readJson } from "./load.js";

type JsonObject = Record<string, unknown>;

const DATA_DIR = "src/data/yt-dlp";
const OPTIONS_PATH = "src/spec/yt-dlp/options.json";

const REQUIRED_IDS = [
  "best-video",
  "audio-mp3",
  "list-formats",
  "subtitles-only",
  "playlist-range",
  "clip-by-section",
];
const RECIPE_KEYS = new Set(["id", "name", "tool", "args", "confidence"]);
const ARG_KEYS = new Set(["kind", "name", "value", "values", "alias"]);
const ARG_KINDS = new Set(["flag", "option", "value"]);
const CONFIDENCE = new Set(["verified", "validated", "unverified"]);
const PLACEHOLDER = /\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g;
const ALLOWED_VARS = new Set(["sourceUrl", "outputPath"]);
const UNSAFE_NAMES = new Set(["--exec", "--exec-before-download", "--postprocessor-args", "--ppa"]);

const VARS = {
  sourceUrl: "https://example.com/watch?v=abc",
  outputPath: "out",
};

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

function toRecipe(entry: JsonObject, label: string): Recipe {
  return {
    id: asString(entry.id, `${label} id`),
    name: asString(entry.name, `${label} name`),
    tool: entry.tool as Recipe["tool"],
    args: entry.args as readonly PlanArg[],
    confidence: entry.confidence as Recipe["confidence"],
  };
}

function strings(value: unknown): readonly string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap((item) => strings(item));
  if (isObject(value)) return Object.values(value).flatMap((item) => strings(item));
  return [];
}

const optionKinds = new Map<string, string>();
let recipes: readonly Recipe[] = [];

beforeAll(() => {
  const optionsDoc = asObject(readJson(OPTIONS_PATH), "options spec");
  for (const entry of asArray(optionsDoc.options, "options")) {
    const option = asObject(entry, "option");
    const kind = asString(option.kind, "option kind");
    optionKinds.set(asString(option.name, "option name"), kind);
    if (option.alias !== undefined) {
      optionKinds.set(asString(option.alias, "option alias"), kind);
    }
  }

  const rows: Recipe[] = [];
  const files = loadJsonDir(DATA_DIR);
  expect(files.length).toBeGreaterThanOrEqual(1);
  for (const file of files) {
    const entries = asArray(file.data, `${file.file} data`);
    expect(entries.length, `${file.file} must not be empty`).toBeGreaterThan(0);
    entries.forEach((entry, index) => {
      rows.push(toRecipe(asObject(entry, `${file.file}[${index}]`), `${file.file}[${index}]`));
    });
  }
  recipes = rows;
});

describe("yt-dlp recipe data", () => {
  it("holds unique recipe ids", () => {
    const ids = recipes.map((recipe) => recipe.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("starts with the six picker recipes in order", () => {
    expect(recipes.slice(0, REQUIRED_IDS.length).map((recipe) => recipe.id)).toEqual(REQUIRED_IDS);
    const ids = new Set(recipes.map((recipe) => recipe.id));
    for (const required of REQUIRED_IDS) {
      expect(ids.has(required), `${required} is missing`).toBe(true);
    }
  });

  it("adds recipes for the More list", () => {
    expect(recipes.length).toBeGreaterThan(REQUIRED_IDS.length + 5);
  });

  it("gives every recipe the core Recipe shape", () => {
    for (const recipe of recipes) {
      const raw = recipe as unknown as JsonObject;
      for (const key of Object.keys(raw)) {
        expect(RECIPE_KEYS.has(key), `${recipe.id} has unknown key "${key}"`).toBe(true);
      }
      expect(recipe.id, `${recipe.id} has a bad id`).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(recipe.name.length, `${recipe.id} needs a name`).toBeGreaterThan(0);
      expect(recipe.tool, `${recipe.id} must use yt-dlp`).toBe("yt-dlp");
      expect(recipe.args.length, `${recipe.id} needs at least one arg`).toBeGreaterThan(0);
      expect(CONFIDENCE.has(String(recipe.confidence)), `${recipe.id} has a bad confidence`).toBe(
        true,
      );
    }
  });

  it("gives every arg a valid PlanArg shape", () => {
    for (const recipe of recipes) {
      for (const arg of recipe.args) {
        const raw = arg as unknown as JsonObject;
        for (const key of Object.keys(raw)) {
          expect(ARG_KEYS.has(key), `${recipe.id} arg "${arg.name}" key "${key}"`).toBe(true);
        }
        expect(ARG_KINDS.has(arg.kind), `${recipe.id} arg "${arg.name}" has a bad kind`).toBe(true);
        expect(arg.name.length, `${recipe.id} arg needs a name`).toBeGreaterThan(0);
        if (arg.kind === "flag") {
          expect(
            arg.value,
            `${recipe.id} flag "${arg.name}" must not take a value`,
          ).toBeUndefined();
        }
        if (arg.kind === "option") {
          expect(
            typeof arg.value === "string" && arg.value.length > 0,
            `${recipe.id} option "${arg.name}" needs a value`,
          ).toBe(true);
        }
        if (arg.kind === "value") {
          expect(arg.name.startsWith("-"), `${recipe.id} has a bad positional arg`).toBe(false);
        }
      }
    }
  });

  it("only uses options from the spec with matching kinds", () => {
    for (const recipe of recipes) {
      for (const arg of recipe.args) {
        if (arg.kind === "value") continue;
        const key = arg.alias ?? arg.name;
        const expected = optionKinds.get(key);
        expect(expected, `${recipe.id} uses unknown option "${key}"`).toBeDefined();
        expect(expected, `${recipe.id} uses "${key}" with the wrong kind`).toBe(arg.kind);
      }
    }
  });

  it("passes one URL and binds all placeholders", () => {
    for (const recipe of recipes) {
      const urls = recipe.args.filter((arg) => arg.kind === "value");
      expect(urls.length, `${recipe.id} needs exactly one URL`).toBe(1);
      expect(urls[0]?.name, `${recipe.id} URL must bind sourceUrl`).toBe("{{sourceUrl}}");

      for (const text of strings(recipe.args)) {
        for (const match of text.matchAll(PLACEHOLDER)) {
          expect(ALLOWED_VARS.has(match[1] ?? ""), `${recipe.id} has unknown var`).toBe(true);
        }
      }
    }
  });

  it("needs no unsafe flags and resolves with the yt-dlp adapter", () => {
    const adapter = toolAdapters["yt-dlp"];
    for (const recipe of recipes) {
      for (const arg of recipe.args) {
        expect(UNSAFE_NAMES.has(arg.name), `${recipe.id} uses unsafe "${arg.name}"`).toBe(false);
      }
      const step: Step = { id: recipe.id, tool: recipe.tool, args: recipe.args };
      expect(adapter.requiresUnsafe(step), `${recipe.id} needs unsafe mode`).toBe(false);
      const resolution = adapter.planFromStep(step, VARS);
      expect(resolution.findings, `${recipe.id} has findings`).toEqual([]);
      const argv = renderCommand("yt-dlp", resolution.args);
      expect(argv[0]).toBe("yt-dlp");
      expect(argv.join(" ")).not.toContain("{{");
    }
  });
});
