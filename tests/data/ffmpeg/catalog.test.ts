import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DATA_DIR, RECIPE_DIR, array, jsonNames, readJson, record, text } from "./helpers.js";

const PRIMARY = [
  "web-h264",
  "trim-copy",
  "extract-audio",
  "palette-gif",
  "crf-tuning",
  "loudnorm",
] as const;

interface RawList {
  readonly label: string;
  readonly data: Record<string, unknown>;
}

function catalogLists(catalog: Record<string, unknown>): readonly RawList[] {
  return array(catalog.lists, "catalog.lists").map((raw, index) => ({
    label: `catalog.lists[${index}]`,
    data: record(raw, `catalog.lists[${index}]`),
  }));
}

function listItems(list: RawList): readonly Record<string, unknown>[] {
  return array(list.data.items, `${list.label}.items`).map((raw, index) =>
    record(raw, `${list.label}.items[${index}]`),
  );
}

function recipeIds(): ReadonlySet<string> {
  return new Set(jsonNames(RECIPE_DIR).map((name) => name.replace(/\.json$/, "")));
}

const CATALOG = record(readJson(join(DATA_DIR, "catalog.json")), "catalog.json");
const LISTS = catalogLists(CATALOG);

describe("ffmpeg data catalog", () => {
  it("parses every data JSON file", () => {
    const files = [
      join(DATA_DIR, "catalog.json"),
      ...jsonNames(RECIPE_DIR).map((name) => join(RECIPE_DIR, name)),
    ];
    for (const file of files) {
      expect(() => readJson(file), file).not.toThrow();
    }
  });

  it("describes the ffmpeg tool", () => {
    expect(CATALOG.schema).toBe(1);
    expect(CATALOG.tool).toBe("ffmpeg");
  });

  it("defines picker and more lists", () => {
    expect(LISTS.length).toBe(2);
    const ids = LISTS.map((list) => text(list.data.id, `${list.label}.id`));
    expect(ids).toEqual(["picker", "more"]);
    for (const list of LISTS) {
      expect(text(list.data.title, `${list.label}.title`).length).toBeGreaterThan(0);
    }
  });

  it("lists every recipe exactly once", () => {
    const known = recipeIds();
    const seen = new Set<string>();
    for (const list of LISTS) {
      for (const item of listItems(list)) {
        const id = text(item.id, `${list.label}.item.id`);
        expect(known.has(id), id).toBe(true);
        expect(seen.has(id), id).toBe(false);
        seen.add(id);
        expect(text(item.hint, id).length, id).toBeGreaterThan(0);
      }
    }
    expect(seen.size).toBe(known.size);
  });

  it("puts the primary recipes in the picker", () => {
    const picker = LISTS.find((list) => list.data.id === "picker");
    if (picker === undefined) throw new Error("catalog is missing the picker list");
    const ids = new Set(listItems(picker).map((item) => text(item.id, "picker item id")));
    for (const id of PRIMARY) {
      expect(ids.has(id), id).toBe(true);
    }
  });

  it("puts at least four recipes in the more list", () => {
    const more = LISTS.find((list) => list.data.id === "more");
    if (more === undefined) throw new Error("catalog is missing the more list");
    expect(listItems(more).length).toBeGreaterThanOrEqual(4);
  });
});
