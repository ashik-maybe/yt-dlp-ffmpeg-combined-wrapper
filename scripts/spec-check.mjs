import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const DEFAULT_ROOTS = ["src/data", "src/spec"];

async function collectJsonFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectJsonFiles(full)));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".json")) {
      files.push(full);
    }
  }
  return files;
}

function isRecipe(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof value.id === "string" &&
    value.id.trim() !== "" &&
    typeof value.tool === "string" &&
    value.tool !== "" &&
    Array.isArray(value.args)
  );
}

function collectRecipes(value, out) {
  if (Array.isArray(value)) {
    for (const item of value) collectRecipes(item, out);
    return;
  }
  if (value === null || typeof value !== "object") return;
  if (isRecipe(value)) {
    out.push(value);
    return;
  }
  for (const item of Object.values(value)) collectRecipes(item, out);
}

function toolOf(recipe) {
  return typeof recipe.tool === "string" && recipe.tool !== "" ? recipe.tool : "unknown";
}

export async function checkSpecs(roots = DEFAULT_ROOTS) {
  const files = [];
  const errors = [];

  for (const root of roots) {
    if (!existsSync(root)) continue;
    try {
      files.push(...(await collectJsonFiles(root)));
    } catch (error) {
      errors.push({
        code: "E_READ_DIR",
        file: root,
        message: `${root}: cannot read directory: ${error.message}`,
      });
    }
  }
  files.sort((a, b) => a.localeCompare(b));

  const recipes = [];
  for (const file of files) {
    let text;
    try {
      text = await readFile(file, "utf8");
    } catch (error) {
      errors.push({
        code: "E_READ_FILE",
        file,
        message: `${file}: cannot read file: ${error.message}`,
      });
      continue;
    }

    let value;
    try {
      value = JSON.parse(text.replace(/^\uFEFF/, ""));
    } catch (error) {
      errors.push({
        code: "E_INVALID_JSON",
        file,
        message: `${file}: invalid JSON: ${error.message}`,
      });
      continue;
    }

    const found = [];
    collectRecipes(value, found);
    for (const recipe of found) {
      recipes.push({ id: recipe.id, tool: toolOf(recipe), file });
    }
  }

  const seen = new Map();
  for (const recipe of recipes) {
    const prior = seen.get(recipe.id);
    if (prior === undefined) {
      seen.set(recipe.id, recipe.file);
      continue;
    }
    errors.push({
      code: "E_DUPLICATE_ID",
      file: recipe.file,
      message:
        prior === recipe.file
          ? `${recipe.file}: duplicate recipe id "${recipe.id}"`
          : `${recipe.file}: duplicate recipe id "${recipe.id}" (also in ${prior})`,
    });
  }

  const counts = {};
  for (const recipe of recipes) {
    counts[recipe.tool] = (counts[recipe.tool] ?? 0) + 1;
  }
  const sortedCounts = Object.fromEntries(
    Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)),
  );

  return {
    ok: errors.length === 0,
    files,
    recipeCount: recipes.length,
    counts: sortedCounts,
    errors,
  };
}

function plural(count, word) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export async function main(argv = process.argv.slice(2)) {
  const roots = argv.filter((arg) => !arg.startsWith("-"));
  const result = await checkSpecs(roots.length > 0 ? roots : DEFAULT_ROOTS);

  console.log(
    `spec-check: ${plural(result.files.length, "file")}, ${plural(result.recipeCount, "recipe")}`,
  );
  for (const [tool, count] of Object.entries(result.counts)) {
    console.log(`  ${tool}: ${count}`);
  }

  if (!result.ok) {
    for (const error of result.errors) {
      console.error(`  ${error.message}`);
    }
    console.error(`spec-check: failed (${plural(result.errors.length, "error")})`);
    process.exitCode = 1;
    return 1;
  }

  console.log("spec-check: ok");
  process.exitCode = 0;
  return 0;
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) {
  await main();
}
