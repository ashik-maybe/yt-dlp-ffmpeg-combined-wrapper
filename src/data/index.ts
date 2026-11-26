import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Confidence, PlanArg, Recipe, Tool } from "../core/index.js";

export interface RecipeFile {
  readonly file: string;
  readonly data: unknown;
}

const CONFIDENCES: ReadonlySet<string> = new Set(["verified", "validated", "unverified"]);

const cache = new Map<Tool, readonly Recipe[]>();
let combined: readonly Recipe[] | undefined;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readJson(relative: string): unknown {
  const url = new URL(relative, import.meta.url);
  try {
    return JSON.parse(readFileSync(url, "utf8")) as unknown;
  } catch (error) {
    throw new Error(`cannot read recipe file "${relative}"`, { cause: error });
  }
}

function recipeFiles(tool: Tool): readonly RecipeFile[] {
  if (tool === "yt-dlp") {
    const file = "yt-dlp/recipes.json";
    return [{ file, data: readJson(file) }];
  }
  const dir = fileURLToPath(new URL("ffmpeg/recipes/", import.meta.url));
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => {
      const file = `ffmpeg/recipes/${name}`;
      return { file, data: readJson(file) };
    });
}

function toRecipe(value: unknown, tool: Tool, file: string): Recipe {
  if (!isRecord(value)) {
    throw new Error(`${file}: recipe must be an object`);
  }
  const id = value.id;
  if (typeof id !== "string" || id.length === 0) {
    throw new Error(`${file}: recipe id must be a non-empty string`);
  }
  if (value.tool !== tool) {
    throw new Error(`${file}: recipe "${id}" must use tool "${tool}"`);
  }
  if (typeof value.name !== "string" || value.name.length === 0) {
    throw new Error(`${file}: recipe "${id}" needs a name`);
  }
  if (!Array.isArray(value.args) || value.args.length === 0) {
    throw new Error(`${file}: recipe "${id}" needs args`);
  }
  const confidence = value.confidence;
  if (confidence !== undefined && (typeof confidence !== "string" || !CONFIDENCES.has(confidence))) {
    throw new Error(`${file}: recipe "${id}" has an invalid confidence`);
  }
  return {
    id,
    name: value.name,
    tool,
    args: value.args as readonly PlanArg[],
    confidence: confidence as Confidence | undefined,
  };
}

export function mergeRecipes(tool: Tool, files: readonly RecipeFile[]): readonly Recipe[] {
  const recipes: Recipe[] = [];
  const ids = new Set<string>();
  for (const file of files) {
    const entries = Array.isArray(file.data) ? file.data : [file.data];
    for (const entry of entries) {
      const recipe = toRecipe(entry, tool, file.file);
      if (ids.has(recipe.id)) {
        throw new Error(`duplicate recipe id "${recipe.id}" in ${file.file}`);
      }
      ids.add(recipe.id);
      recipes.push(recipe);
    }
  }
  return recipes;
}

export function loadRecipes(tool: Tool): readonly Recipe[] {
  const cached = cache.get(tool);
  if (cached !== undefined) {
    return cached;
  }
  const recipes = mergeRecipes(tool, recipeFiles(tool));
  cache.set(tool, recipes);
  return recipes;
}

export function allRecipes(): readonly Recipe[] {
  if (combined !== undefined) {
    return combined;
  }
  const recipes = [...loadRecipes("yt-dlp"), ...loadRecipes("ffmpeg")];
  const ids = new Set<string>();
  for (const recipe of recipes) {
    if (ids.has(recipe.id)) {
      throw new Error(`duplicate recipe id "${recipe.id}" across tools`);
    }
    ids.add(recipe.id);
  }
  combined = recipes;
  return recipes;
}
