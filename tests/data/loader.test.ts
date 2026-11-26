import { describe, expect, it } from "vitest";
import type { Tool } from "../../src/core/index.js";
import type { RecipeFile } from "../../src/data/index.js";
import { allRecipes, loadRecipes, mergeRecipes } from "../../src/data/index.js";
import { allTasks, curatedTasks } from "../../src/recipes/index.js";

const CURATED: Readonly<Record<Tool, readonly string[]>> = {
  "yt-dlp": [
    "best-video",
    "audio-mp3",
    "list-formats",
    "subtitles-only",
    "playlist-range",
    "clip-by-section",
  ],
  ffmpeg: ["web-h264", "trim-copy", "extract-audio", "palette-gif", "crf-tuning", "loudnorm"],
};

const TOOLS: readonly Tool[] = ["yt-dlp", "ffmpeg"];

function uniqueIds(recipes: readonly { readonly id: string }[]): number {
  return new Set(recipes.map((recipe) => recipe.id)).size;
}

describe("recipe loader", () => {
  it("loads the yt-dlp recipe array", () => {
    const recipes = loadRecipes("yt-dlp");
    expect(recipes.length).toBe(21);
    expect(recipes[0]?.id).toBe("best-video");
    expect(recipes.every((recipe) => recipe.tool === "yt-dlp")).toBe(true);
    expect(uniqueIds(recipes)).toBe(recipes.length);
  });

  it("loads each ffmpeg recipe file", () => {
    const recipes = loadRecipes("ffmpeg");
    expect(recipes.length).toBe(14);
    expect(recipes.every((recipe) => recipe.tool === "ffmpeg")).toBe(true);
    expect(uniqueIds(recipes)).toBe(recipes.length);
  });

  it("returns the cached list on later calls", () => {
    expect(loadRecipes("yt-dlp")).toBe(loadRecipes("yt-dlp"));
    expect(loadRecipes("ffmpeg")).toBe(loadRecipes("ffmpeg"));
  });

  it("keeps every entry in the core Recipe shape", () => {
    for (const tool of TOOLS) {
      for (const recipe of loadRecipes(tool)) {
        expect(recipe.id, recipe.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
        expect(recipe.name.length, recipe.id).toBeGreaterThan(0);
        expect(recipe.tool, recipe.id).toBe(tool);
        expect(recipe.args.length, recipe.id).toBeGreaterThan(0);
      }
    }
  });

  it("merges both tools without duplicate ids", () => {
    const recipes = allRecipes();
    expect(recipes.length).toBe(loadRecipes("yt-dlp").length + loadRecipes("ffmpeg").length);
    expect(uniqueIds(recipes)).toBe(recipes.length);
    expect(new Set(recipes.map((recipe) => recipe.tool))).toEqual(new Set(TOOLS));
    expect(allRecipes()).toBe(recipes);
  });

  it("rejects duplicate ids in one file", () => {
    const [recipe] = loadRecipes("yt-dlp");
    const files: readonly RecipeFile[] = [{ file: "fixture.json", data: [recipe, recipe] }];
    expect(() => mergeRecipes("yt-dlp", files)).toThrow(/duplicate recipe id/);
  });

  it("rejects duplicate ids across files", () => {
    const [recipe] = loadRecipes("ffmpeg");
    const files: readonly RecipeFile[] = [
      { file: "a.json", data: [recipe] },
      { file: "b.json", data: [recipe] },
    ];
    expect(() => mergeRecipes("ffmpeg", files)).toThrow(/duplicate recipe id/);
  });

  it("rejects a recipe for the wrong tool", () => {
    const [recipe] = loadRecipes("ffmpeg");
    const files: readonly RecipeFile[] = [{ file: "fixture.json", data: [recipe] }];
    expect(() => mergeRecipes("yt-dlp", files)).toThrow(/must use tool/);
  });
});

describe("task lists", () => {
  it("gives six curated tasks per tool", () => {
    const tasks = curatedTasks();
    expect(tasks.length).toBe(12);
    for (const tool of TOOLS) {
      const rows = tasks.filter((task) => task.tool === tool);
      expect(rows.length, tool).toBe(6);
      expect(
        rows.map((task) => task.id),
        tool,
      ).toEqual([...CURATED[tool]]);
      for (const row of rows) {
        expect(row.label.length, row.id).toBeGreaterThan(0);
        expect(row.hint.length, row.id).toBeGreaterThan(0);
      }
    }
  });

  it("only uses curated ids that exist", () => {
    const ids = new Set(allRecipes().map((recipe) => recipe.id));
    for (const task of curatedTasks()) {
      expect(ids.has(task.id), task.id).toBe(true);
    }
  });

  it("lists every recipe in order", () => {
    const recipes = allRecipes();
    const tasks = allTasks();
    expect(tasks.length).toBe(recipes.length);
    expect(tasks.length).toBe(35);
    expect(tasks.map((task) => task.id)).toEqual(recipes.map((recipe) => recipe.id));
    expect(uniqueIds(tasks)).toBe(tasks.length);
  });

  it("counts the tasks for each tool", () => {
    const tasks = allTasks();
    expect(tasks.filter((task) => task.tool === "yt-dlp").length).toBe(21);
    expect(tasks.filter((task) => task.tool === "ffmpeg").length).toBe(14);
  });
});
