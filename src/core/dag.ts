import type { Finding, Step } from "./types.js";

export interface DagResult {
  readonly ok: boolean;
  readonly findings: readonly Finding[];
}

export interface TopoResult {
  readonly ok: boolean;
  readonly order: readonly string[];
  readonly findings: readonly Finding[];
}

function err(code: string, message: string, location?: string): Finding {
  return { severity: "error", code, message, location };
}

export function validateDag(steps: readonly Step[]): DagResult {
  const findings: Finding[] = [];
  const ids = new Set<string>();

  for (const step of steps) {
    if (ids.has(step.id)) {
      findings.push(err("E_DUPLICATE_ID", `duplicate step id "${step.id}"`, `step:${step.id}`));
    }
    ids.add(step.id);
  }

  for (const step of steps) {
    for (const dep of step.dependsOn ?? []) {
      if (!ids.has(dep)) {
        findings.push(
          err(
            "E_MISSING_DEP",
            `step "${step.id}" depends on missing id "${dep}"`,
            `step:${step.id}`,
          ),
        );
      }
    }
  }

  const topo = topoOrder(steps);
  for (const f of topo.findings) {
    if (f.code === "E_CYCLE") {
      findings.push(f);
    }
  }

  return { ok: findings.every((f) => f.severity !== "error"), findings };
}

export function topoOrder(steps: readonly Step[]): TopoResult {
  const findings: Finding[] = [];
  const ids = new Set<string>();
  for (const step of steps) {
    ids.add(step.id);
  }

  for (const step of steps) {
    for (const dep of step.dependsOn ?? []) {
      if (!ids.has(dep)) {
        findings.push(
          err(
            "E_MISSING_DEP",
            `step "${step.id}" depends on missing id "${dep}"`,
            `step:${step.id}`,
          ),
        );
      }
    }
  }

  const indegree = new Map<string, number>();
  const edges = new Map<string, string[]>();
  for (const step of steps) {
    indegree.set(step.id, 0);
    edges.set(step.id, []);
  }
  for (const step of steps) {
    for (const dep of step.dependsOn ?? []) {
      if (!ids.has(dep)) continue;
      edges.get(dep)?.push(step.id);
      indegree.set(step.id, (indegree.get(step.id) ?? 0) + 1);
    }
  }

  const queue: string[] = [];
  for (const step of steps) {
    if ((indegree.get(step.id) ?? 0) === 0) {
      queue.push(step.id);
    }
  }

  const order: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift();
    if (id === undefined) break;
    order.push(id);
    for (const next of edges.get(id) ?? []) {
      const nextDeg = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, nextDeg);
      if (nextDeg === 0) {
        queue.push(next);
      }
    }
  }

  if (order.length !== steps.length) {
    const cycleIds = steps.map((s) => s.id).filter((id) => !order.includes(id));
    findings.push(
      err("E_CYCLE", `dependency cycle blocks these steps: ${cycleIds.join(", ")}`, "steps"),
    );
  }

  return {
    ok: findings.every((f) => f.severity !== "error"),
    order,
    findings,
  };
}
