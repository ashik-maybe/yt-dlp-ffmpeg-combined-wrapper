import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";

const DEFAULT_KILL_GRACE_MS = 2000;
const ENOENT_EXIT_CODE = 127;
const ABORT_EXIT_CODE = 130;

export interface RunOptions {
  /** Aborting sends SIGTERM, then SIGKILL after a short delay. */
  readonly signal?: AbortSignal;
  /** Delay between SIGTERM and SIGKILL. Defaults to 2000 ms. */
  readonly killGraceMs?: number;
  readonly onStdout?: (chunk: string) => void;
  readonly onStderr?: (chunk: string) => void;
}

export interface RunResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  /** True when the signal caused the process to stop. */
  readonly aborted: boolean;
  /** Spawn failure detail, such as a missing binary. */
  readonly error?: string;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function invalidResult(message: string): RunResult {
  return { exitCode: 1, stdout: "", stderr: "", aborted: false, error: message };
}

/**
 * Run a command without a shell.
 * Captures stdout and stderr.
 * An abort sends SIGTERM, then SIGKILL after a short delay.
 */
export function runProcess(argv: readonly string[], options: RunOptions = {}): Promise<RunResult> {
  const [command, ...args] = argv;
  if (command === undefined || command === "") {
    return Promise.resolve(invalidResult("argv must contain a command"));
  }

  const { signal, killGraceMs = DEFAULT_KILL_GRACE_MS, onStdout, onStderr } = options;

  return new Promise<RunResult>((resolve) => {
    let child: ChildProcess;
    try {
      child = spawn(command, args, {
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
    } catch (error) {
      resolve(invalidResult(describeError(error)));
      return;
    }

    let stdout = "";
    let stderr = "";
    let aborted = false;
    let abortRequested = false;
    let termSent = false;
    let settled = false;
    let killTimer: ReturnType<typeof setTimeout> | undefined;

    const exited = (): boolean => child.exitCode !== null || child.signalCode !== null;

    const sendTerm = (): void => {
      if (termSent || exited()) return;
      termSent = child.kill("SIGTERM");
    };

    const onAbort = (): void => {
      if (settled || abortRequested || exited()) return;
      abortRequested = true;
      aborted = true;
      sendTerm();
      killTimer = setTimeout(() => {
        if (!exited()) child.kill("SIGKILL");
      }, killGraceMs);
    };

    const finish = (result: RunResult): void => {
      if (settled) return;
      settled = true;
      if (killTimer !== undefined) clearTimeout(killTimer);
      signal?.removeEventListener("abort", onAbort);
      resolve(result);
    };

    child.stdout?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      stdout += chunk;
      onStdout?.(chunk);
    });

    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk: string) => {
      stderr += chunk;
      onStderr?.(chunk);
    });

    // Retry SIGTERM if the abort arrived before the process had a pid.
    child.on("spawn", () => {
      if (abortRequested) sendTerm();
    });

    child.on("error", (error: NodeJS.ErrnoException) => {
      const exitCode = error.code === "ENOENT" ? ENOENT_EXIT_CODE : 1;
      finish({ exitCode, stdout, stderr, aborted, error: describeError(error) });
    });

    child.on("close", (code: number | null) => {
      finish({
        exitCode: aborted ? ABORT_EXIT_CODE : (code ?? 1),
        stdout,
        stderr,
        aborted,
      });
    });

    if (signal !== undefined) {
      if (signal.aborted) onAbort();
      else signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}
