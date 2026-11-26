import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runProcess } from "../../src/runner/process.js";
import type { RunResult } from "../../src/runner/process.js";

let dir = "";

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "orbit-runner-"));
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function script(
  name: string,
  source: string,
  args: readonly string[] = [],
): Promise<string[]> {
  const path = join(dir, name);
  await writeFile(path, source, "utf8");
  return [process.execPath, path, ...args];
}

/** Abort as soon as the child prints "ready". */
function abortWhenReady(argv: readonly string[], killGraceMs?: number): Promise<RunResult> {
  const controller = new AbortController();
  return runProcess(argv, {
    signal: controller.signal,
    killGraceMs,
    onStdout: (chunk) => {
      if (chunk.includes("ready")) controller.abort();
    },
  });
}

describe("runProcess", () => {
  it("captures stdout, stderr, and a zero exit code", async () => {
    const argv = await script(
      "success.mjs",
      "process.stdout.write('hello'); process.stderr.write('warning');",
    );

    const result = await runProcess(argv);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("hello");
    expect(result.stderr).toBe("warning");
    expect(result.aborted).toBe(false);
    expect(result.error).toBeUndefined();
  });

  it("returns the exit code and partial output of a failed command", async () => {
    const argv = await script(
      "failure.mjs",
      "process.stdout.write('partial'); process.stderr.write('boom'); process.exit(3);",
    );

    const result = await runProcess(argv);

    expect(result.exitCode).toBe(3);
    expect(result.stdout).toBe("partial");
    expect(result.stderr).toBe("boom");
    expect(result.aborted).toBe(false);
  });

  it("reports a missing binary as exit code 127", async () => {
    const result = await runProcess([join(dir, "missing-binary")]);

    expect(result.exitCode).toBe(127);
    expect(result.stdout).toBe("");
    expect(result.error).toBeDefined();
  });

  it("passes arguments literally without a shell", async () => {
    const value = "$(echo pwned); echo *";
    const argv = await script("literal.mjs", "process.stdout.write(process.argv[2] ?? '');", [
      value,
    ]);

    const result = await runProcess(argv);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe(value);
  });

  it("streams output chunks to the callbacks", async () => {
    const argv = await script(
      "stream.mjs",
      "process.stdout.write('one'); process.stderr.write('two');",
    );
    let liveOut = "";
    let liveErr = "";

    const result = await runProcess(argv, {
      onStdout: (chunk) => {
        liveOut += chunk;
      },
      onStderr: (chunk) => {
        liveErr += chunk;
      },
    });

    expect(liveOut).toBe("one");
    expect(liveErr).toBe("two");
    expect(result.stdout).toBe(liveOut);
    expect(result.stderr).toBe(liveErr);
  });

  it("aborts with SIGTERM when the signal fires", async () => {
    const argv = await script(
      "term.mjs",
      "process.stdout.write('ready\\n'); setInterval(() => {}, 1000);",
    );

    const result = await abortWhenReady(argv);

    expect(result.aborted).toBe(true);
    expect(result.exitCode).toBe(130);
    expect(result.stdout).toContain("ready");
  });

  it("escalates to SIGKILL when SIGTERM is ignored", async () => {
    const argv = await script(
      "ignore-term.mjs",
      [
        "process.on('SIGTERM', () => {});",
        "process.stdout.write('ready\\n');",
        "setInterval(() => {}, 1000);",
      ].join(" "),
    );

    const result = await abortWhenReady(argv, 100);

    expect(result.aborted).toBe(true);
    expect(result.exitCode).toBe(130);
  });

  it("aborts immediately when the signal is already aborted", async () => {
    const argv = await script("already-aborted.mjs", "setInterval(() => {}, 1000);");
    const controller = new AbortController();
    controller.abort();

    const result = await runProcess(argv, {
      signal: controller.signal,
      killGraceMs: 100,
    });

    expect(result.aborted).toBe(true);
    expect(result.exitCode).toBe(130);
  });

  it("rejects an empty argv without spawning", async () => {
    const result = await runProcess([]);

    expect(result.exitCode).toBe(1);
    expect(result.error).toContain("argv");
  });
});
