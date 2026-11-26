import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { PlanArg, Recipe } from "../../../src/core/index.js";
import { RECIPE_DIR, SPEC_DIR, array, jsonNames, readJson, record, text } from "./helpers.js";

const REQUIRED = [
  "web-h264",
  "trim-copy",
  "extract-audio",
  "palette-gif",
  "crf-tuning",
  "loudnorm",
] as const;
const KINDS = ["flag", "option", "value"];
const CONFIDENCE = ["verified", "validated", "unverified"];
const ARG_KEYS = ["kind", "name", "value", "values", "alias"];
const GRAPH_OPTIONS = ["-vf", "-af", "-filter_complex"];

interface RawRecipe {
  readonly file: string;
  readonly data: Record<string, unknown>;
}

function loadRecipes(): readonly RawRecipe[] {
  return jsonNames(RECIPE_DIR).map((file) => ({
    file,
    data: record(readJson(join(RECIPE_DIR, file)), file),
  }));
}

function recipeArgs(
  data: Record<string, unknown>,
  file: string,
): readonly Record<string, unknown>[] {
  return array(data.args, `${file}.args`).map((raw, index) =>
    record(raw, `${file}.args[${index}]`),
  );
}

function specNames(file: string): ReadonlySet<string> {
  const spec = record(readJson(join(SPEC_DIR, file)), file);
  return new Set(
    array(spec.items, `${file}.items`).map((raw, index) => {
      const item = record(raw, `${file}.items[${index}]`);
      return text(item.name, `${file}.items[${index}].name`);
    }),
  );
}

function graphFilters(graph: string): readonly string[] {
  return graph
    .split(";")
    .flatMap((chain) => chain.split(","))
    .map((segment) => segment.replace(/\[[^\]]*\]/g, ""))
    .map((segment) => segment.split("=")[0] ?? "")
    .filter((name) => name.length > 0);
}

const RECIPES = loadRecipes();
const IDS = new Set(RECIPES.map(({ file, data }) => text(data.id, `${file}.id`)));

describe("ffmpeg recipe data", () => {
  it("contains a recipe file for every id", () => {
    expect(RECIPES.length).toBeGreaterThanOrEqual(12);
    for (const { file, data } of RECIPES) {
      expect(text(data.id, `${file}.id`), file).toBe(file.replace(/\.json$/, ""));
    }
  });

  it("uses unique recipe ids and names", () => {
    const ids = RECIPES.map(({ file, data }) => text(data.id, `${file}.id`));
    expect(new Set(ids).size, "ids").toBe(ids.length);
    const names = RECIPES.map(({ file, data }) => text(data.name, `${file}.name`));
    expect(new Set(names).size, "names").toBe(names.length);
  });

  it("uses the core Recipe shape", () => {
    for (const { file, data } of RECIPES) {
      const id = text(data.id, `${file}.id`);
      expect(id, file).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(text(data.name, `${file}.name`).length, file).toBeGreaterThan(0);
      expect(data.tool, file).toBe("ffmpeg");
      expect(CONFIDENCE, file).toContain(data.confidence);
      expect(recipeArgs(data, file).length, file).toBeGreaterThan(0);
    }
  });

  it("uses only the ffmpeg tool", () => {
    for (const { file, data } of RECIPES) {
      expect(data.tool, file).toBe("ffmpeg");
    }
  });

  it("includes the required recipe ids", () => {
    for (const id of REQUIRED) {
      expect(IDS.has(id), id).toBe(true);
    }
  });

  it("uses PlanArg kind, name, and value fields", () => {
    for (const { file, data } of RECIPES) {
      for (const arg of recipeArgs(data, file)) {
        const kind = text(arg.kind, `${file}.arg.kind`);
        const name = text(arg.name, `${file}.arg.name`);
        const label = `${file} ${name}`;
        expect(KINDS, label).toContain(kind);
        for (const key of Object.keys(arg)) {
          expect(ARG_KEYS, label).toContain(key);
        }
        if (kind === "flag") {
          expect(arg.value, label).toBeUndefined();
          expect(arg.values, label).toBeUndefined();
        } else if (kind === "option") {
          expect(name, label).toMatch(/^-[A-Za-z]/);
          const hasValue = arg.value !== undefined;
          const hasValues = arg.values !== undefined;
          expect(hasValue || hasValues, label).toBe(true);
          expect(hasValue && hasValues, label).toBe(false);
          if (hasValue) expect(typeof arg.value, label).toBe("string");
          if (hasValues) {
            const values = array(arg.values, `${label}.values`);
            expect(values.length, label).toBeGreaterThan(0);
            for (const value of values) text(value, `${label}.values`);
          }
        } else {
          expect(typeof arg.value, label).toBe("string");
        }
      }
    }
  });

  it("declares one input and one output per recipe", () => {
    for (const { file, data } of RECIPES) {
      const args = recipeArgs(data, file);
      const inputs = args.filter((arg) => arg.kind === "option" && arg.name === "-i");
      expect(inputs.length, file).toBe(1);
      expect(inputs[0]?.value, file).toBe("{{input}}");
      const outputs = args.filter((arg) => arg.kind === "value");
      expect(outputs.length, file).toBe(1);
      expect(outputs[0]?.value, file).toBe("{{output}}");
    }
  });

  it("references only known ffmpeg options and flags", () => {
    const known = specNames("options.json");
    for (const { file, data } of RECIPES) {
      for (const arg of recipeArgs(data, file)) {
        const kind = text(arg.kind, file);
        if (kind === "flag" || kind === "option") {
          const name = text(arg.name, file);
          expect(known.has(name), `${file} ${name}`).toBe(true);
        }
      }
    }
  });

  it("references only known ffmpeg filters", () => {
    const known = specNames("filters.json");
    for (const { file, data } of RECIPES) {
      for (const arg of recipeArgs(data, file)) {
        const name = text(arg.name, file);
        if (GRAPH_OPTIONS.includes(name)) {
          const graph = text(arg.value, `${file} ${name}`);
          for (const filter of graphFilters(graph)) {
            expect(known.has(filter), `${file} filter ${filter}`).toBe(true);
          }
        }
      }
    }
  });

  it("exposes recipes as core Recipe values", () => {
    for (const { file, data } of RECIPES) {
      const recipe = data as unknown as Recipe;
      expect(recipe.id, file).toBe(text(data.id, file));
      expect(
        recipe.args.every((arg: PlanArg) => KINDS.includes(arg.kind)),
        file,
      ).toBe(true);
    }
  });
});
