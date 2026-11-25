const BRACE_RE = /\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g;
const ANGLE_RE = /<([A-Za-z0-9_.-]+)>/g;
const PLACEHOLDER_RE = /\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}|<([A-Za-z0-9_.-]+)>/g;

function allNames(text: string): string[] {
  const names: string[] = [];
  PLACEHOLDER_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = PLACEHOLDER_RE.exec(text)) !== null) {
    names.push(match[1] ?? match[2]);
  }
  return names;
}

export function normalizePlaceholders(text: string): string {
  return text.replace(ANGLE_RE, "{{$1}}");
}

export function bindText(text: string, vars: Readonly<Record<string, string>> = {}): string {
  const normalized = normalizePlaceholders(text);
  return normalized.replace(BRACE_RE, (_m, name: string) => {
    if (Object.prototype.hasOwnProperty.call(vars, name)) {
      return vars[name];
    }
    return `{{${name}}}`;
  });
}

export function findUnbound(
  text: string,
  vars: Readonly<Record<string, string>> = {},
): readonly string[] {
  const names = allNames(text);
  const unbound: string[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(vars, name)) continue;
    if (seen.has(name)) continue;
    seen.add(name);
    unbound.push(name);
  }
  return unbound;
}
