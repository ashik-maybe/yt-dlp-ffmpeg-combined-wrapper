import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));

export interface JsonFile {
  readonly file: string;
  readonly data: unknown;
}

export function readJson(relativePath: string): unknown {
  const raw = readFileSync(join(ROOT, relativePath), "utf8");
  return JSON.parse(raw) as unknown;
}

export function loadJsonDir(relativeDir: string): readonly JsonFile[] {
  const dir = join(ROOT, relativeDir);
  const names = readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort();
  return names.map((name) => {
    const raw = readFileSync(join(dir, name), "utf8");
    return { file: `${relativeDir}/${name}`, data: JSON.parse(raw) as unknown };
  });
}
