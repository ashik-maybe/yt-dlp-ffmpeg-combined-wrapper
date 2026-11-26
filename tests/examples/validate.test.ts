import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Finding, PipelinePlan } from "../../src/core/index.js";
import { validateDag, validatePlan } from "../../src/core/index.js";
import { allRecipes } from "../../src/data/index.js";

const PLAN_DIR = fileURLToPath(new URL("../../examples/plans", import.meta.url));

const PLAN_FILES = readdirSync(PLAN_DIR)
  .filter((name) => name.endsWith(".json"))
  .sort();

const RECIPES = new Map(allRecipes().map((recipe) => [recipe.id, recipe]));

const PLACEHOLDER_RE = /\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g;

function findingsText(findings: readonly Finding[]): string {
  return findings.map((finding) => `${finding.code}: ${finding.message}`).join("; ");
}

function readPlan(file: string): unknown {
  return JSON.parse(readFileSync(join(PLAN_DIR, file), "utf8")) as unknown;
}

function validPlan(file: string): PipelinePlan {
  const result = validatePlan(readPlan(file));
  expect(result.ok, `${file}: ${findingsText(result.findings)}`).toBe(true);
  if (result.plan === undefined) {
    throw new Error(`${file}: validatePlan returned no plan`);
  }
  return result.plan;
}

function placeholderNames(plan: PipelinePlan): readonly string[] {
  const texts: string[] = [];
  for (const step of plan.steps) {
    for (const arg of step.args) {
      texts.push(arg.name);
      if (arg.value !== undefined) texts.push(arg.value);
      if (arg.values !== undefined) texts.push(...arg.values);
      if (arg.alias !== undefined) texts.push(arg.alias);
    }
    texts.push(...(step.inputs ?? []), ...(step.outputs ?? []));
  }
  const names = new Set<string>();
  for (const text of texts) {
    for (const match of text.matchAll(PLACEHOLDER_RE)) {
      if (match[1] !== undefined) names.add(match[1]);
    }
  }
  return [...names];
}

describe("example plans", () => {
  it("ships five plan files", () => {
    expect(PLAN_FILES).toHaveLength(5);
  });

  it("uses unique plan ids that match the file names", () => {
    const ids = PLAN_FILES.map((file) => validPlan(file).id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const file of PLAN_FILES) {
      expect(validPlan(file).id, file).toBe(file.replace(/\.json$/, ""));
    }
  });

  for (const file of PLAN_FILES) {
    describe(file, () => {
      it("passes validatePlan", () => {
        validPlan(file);
      });

      it("passes validateDag", () => {
        const plan = validPlan(file);
        const result = validateDag(plan.steps);
        expect(result.ok, `${file}: ${findingsText(result.findings)}`).toBe(true);
      });

      it("uses unique step ids", () => {
        const ids = validPlan(file).steps.map((step) => step.id);
        expect(new Set(ids).size).toBe(ids.length);
      });

      it("uses the recipe tool for every step", () => {
        const plan = validPlan(file);
        for (const step of plan.steps) {
          const recipeId = step.recipeId;
          expect(recipeId, `${file}: step "${step.id}" has no recipeId`).toBeDefined();
          const recipe = RECIPES.get(recipeId ?? "");
          expect(recipe, `${file}: recipe "${recipeId}" is not in src/data`).toBeDefined();
          expect(recipe?.tool, `${file}: step "${step.id}" uses the wrong tool`).toBe(step.tool);
        }
      });

      it("binds every placeholder in vars", () => {
        const plan = validPlan(file);
        const vars = plan.vars ?? {};
        const names = placeholderNames(plan);
        expect(names.length).toBeGreaterThan(0);
        for (const name of names) {
          expect(vars[name], `${file}: var "${name}" is missing`).toBeDefined();
        }
      });
    });
  }
});
