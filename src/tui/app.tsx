import { existsSync } from "node:fs";
import { Box, Text, useApp, useInput } from "ink";
import { useCallback, useMemo, useRef, useState } from "react";
import { bindText, collectGuards, renderCommand } from "../core/index.js";
import type { Finding, PipelinePlan, PlanArg, StepResult } from "../core/index.js";
import { VERSION } from "../cli/version.js";
import { ffmpegAdapter } from "../planners/ffmpeg/index.js";
import { ytDlpAdapter } from "../planners/yt-dlp/index.js";
import { executePlan } from "../runner/index.js";
import { Chrome, HelpOverlay } from "./components/index.js";
import { Confirm, More, MORE_TASK_ID, Picker, Progress, Review, Summary } from "./screens/index.js";
import { isNarrow } from "./theme.js";
import type { ScreenName, ScreenProps, StepStatus, StepView, TaskItem, TuiProps } from "./types.js";

/** One request to run a whole plan. */
export interface RunRequest {
  readonly plan: PipelinePlan;
  readonly unsafe: boolean;
  readonly force: boolean;
  readonly dryRun: boolean;
  readonly signal?: AbortSignal;
}

/** Runs a plan and returns one result for each executed step. */
export type PlanExecutor = (request: RunRequest) => Promise<readonly StepResult[]>;

export interface AppProps extends TuiProps {
  /** Version shown in the chrome. Defaults to the package version. */
  readonly version?: string;
  /** Terminal width. Defaults to the real stdout width. */
  readonly columns?: number;
  /** Test seam. Replaces the real runner. */
  readonly executor?: PlanExecutor;
  /** Called when the user quits. Defaults to app exit. */
  readonly onQuit?: () => void;
}

const ADAPTERS = {
  "yt-dlp": ytDlpAdapter,
  ffmpeg: ffmpegAdapter,
} as const;

const defaultExecutor: PlanExecutor = (request) =>
  executePlan(request.plan, ADAPTERS, {
    dryRun: false,
    unsafe: request.unsafe,
    force: request.force,
    signal: request.signal,
  });

const SCREEN_STEP: Readonly<Record<ScreenName, number>> = {
  picker: 1,
  more: 2,
  review: 3,
  confirm: 4,
  progress: 5,
  summary: 6,
};

const SCREEN_TOTAL = 6;

function bindArg(arg: PlanArg, vars: Readonly<Record<string, string>>): PlanArg {
  return {
    kind: arg.kind,
    name: bindText(arg.name, vars),
    ...(arg.value !== undefined ? { value: bindText(arg.value, vars) } : {}),
    ...(arg.values !== undefined
      ? { values: arg.values.map((value) => bindText(value, vars)) }
      : {}),
    ...(arg.alias !== undefined ? { alias: bindText(arg.alias, vars) } : {}),
  };
}

function buildViews(plan: PipelinePlan): StepView[] {
  const vars = plan.vars ?? {};
  return plan.steps.map((step) => ({
    id: step.id,
    tool: step.tool,
    label: step.recipeId ?? step.id,
    command: renderCommand(
      step.tool,
      step.args.map((arg) => bindArg(arg, vars)),
    ).join(" "),
    status: "pending",
  }));
}

function withStatus(view: StepView, status: StepStatus): StepView {
  return { ...view, status };
}

/** Combined TUI app. It owns screen routing and global keys. */
export function App(props: AppProps) {
  const { runEnabled, yes, force, unsafe, plan } = props;
  const version = props.version ?? VERSION;
  const columns = props.columns ?? process.stdout.columns ?? 100;
  const narrow = isNarrow(columns);
  const executor = props.executor ?? defaultExecutor;
  const { exit } = useApp();

  const [screen, setScreen] = useState<ScreenName>("picker");
  const [selectedId, setSelectedId] = useState(() => plan.steps[0]?.id ?? "");
  const [help, setHelp] = useState(false);
  const [views, setViews] = useState(() => buildViews(plan));
  const [logs, setLogs] = useState<readonly string[]>([]);
  const [notice, setNotice] = useState("");
  const [running, setRunning] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);
  const findings = useMemo<readonly Finding[]>(
    () => collectGuards(plan, { force, unsafe, exists: existsSync }),
    [plan, force, unsafe],
  );

  const tasks = useMemo<readonly TaskItem[]>(
    () =>
      plan.steps.map((step, index) => ({
        id: step.id,
        tool: step.tool,
        label: views[index]?.label ?? step.id,
        hint: views[index]?.command ?? "",
      })),
    [plan, views],
  );

  const quit = useCallback(() => {
    if (props.onQuit !== undefined) {
      props.onQuit();
      return;
    }
    exit();
  }, [props, exit]);

  function go(next: ScreenName) {
    setNotice("");
    setScreen(next);
  }

  function resetToPicker() {
    runIdRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    setRunning(false);
    setViews(buildViews(plan));
    setLogs([]);
    setNotice("");
    setSelectedId(plan.steps[0]?.id ?? "");
    setScreen("picker");
  }

  async function startRun() {
    if (!runEnabled) {
      setNotice("Execution is off. Restart with --run.");
      return;
    }
    const blocking = findings.find((finding) => finding.severity === "error");
    if (blocking !== undefined) {
      setNotice(`Blocked by ${blocking.code}: ${blocking.message}`);
      return;
    }
    if (running) return;

    const controller = new AbortController();
    controllerRef.current = controller;
    const runId = ++runIdRef.current;
    setNotice("");
    setRunning(true);
    setScreen("progress");
    setViews(
      buildViews(plan).map((view, index) => (index === 0 ? withStatus(view, "running") : view)),
    );
    setLogs([`Starting ${plan.name}`]);

    try {
      const results = await executor({
        plan,
        unsafe,
        force,
        dryRun: false,
        signal: controller.signal,
      });
      if (runId !== runIdRef.current) return;

      const byId = new Map(results.map((result) => [result.stepId, result]));
      setViews(
        buildViews(plan).map((view) => {
          const result = byId.get(view.id);
          if (result === undefined) return withStatus(view, "skipped");
          return withStatus(view, result.ok ? "ok" : "failed");
        }),
      );
      const ok = results.length === plan.steps.length && results.every((result) => result.ok);
      setLogs((current) => [
        ...current,
        `Finished: ${results.filter((result) => result.ok).length}/${plan.steps.length} ok`,
      ]);
      setNotice(ok ? "" : "One or more steps failed.");
      setScreen("summary");
    } catch (error) {
      if (runId !== runIdRef.current) return;
      const detail = error instanceof Error ? error.message : String(error);
      setViews((current) =>
        current.map((view) =>
          view.status === "ok" || view.status === "failed" || view.status === "skipped"
            ? view
            : withStatus(view, "failed"),
        ),
      );
      setLogs((current) => [...current, `Run failed: ${detail}`]);
      setNotice(`Run failed: ${detail}`);
      setScreen("summary");
    } finally {
      if (runId === runIdRef.current) {
        controllerRef.current = null;
        setRunning(false);
      }
    }
  }

  function abortRun() {
    runIdRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    if (!running) return;
    setRunning(false);
    setViews((current) =>
      current.map((view) => {
        if (view.status === "running") return withStatus(view, "failed");
        if (view.status === "pending") return withStatus(view, "skipped");
        return view;
      }),
    );
    setLogs((current) => [...current, "Aborted by user."]);
    setNotice("Run aborted.");
    setScreen("summary");
  }

  function requestRun() {
    if (!runEnabled) {
      setNotice("Dry-run only. Restart with --run to execute.");
      return;
    }
    if (yes) {
      void startRun();
      return;
    }
    go("confirm");
  }

  function continueFromReview() {
    if (runEnabled && yes) {
      void startRun();
      return;
    }
    go("confirm");
  }

  function confirmRun() {
    if (!runEnabled) {
      setNotice("Execution is off. Restart with --run.");
      return;
    }
    void startRun();
  }

  function selectTask(id: string) {
    if (id === MORE_TASK_ID) {
      go("more");
      return;
    }
    setSelectedId(id);
    go("review");
  }

  useInput((input, key) => {
    if (key.ctrl && input === "c") {
      if (running) abortRun();
      quit();
      return;
    }

    if (help) {
      if (input === "q") quit();
      return;
    }

    if (input === "?") {
      setHelp(true);
      return;
    }

    if (input === "q") {
      if (screen === "more" || screen === "summary") return;
      if (running) abortRun();
      quit();
      return;
    }

    if (key.return && screen === "summary") {
      resetToPicker();
      return;
    }

    if (input === "m" && screen === "picker") {
      go("more");
      return;
    }

    if (input === "r" && (screen === "review" || screen === "confirm")) {
      requestRun();
      return;
    }

    if (input === "a") {
      if (screen === "confirm") confirmRun();
      else if (screen === "progress") abortRun();
      return;
    }

    if (key.escape) {
      if (screen === "picker") {
        quit();
        return;
      }
      if (screen === "progress") {
        abortRun();
        return;
      }
      if (screen === "summary") resetToPicker();
    }
  });

  const common: ScreenProps = {
    tasks,
    selectedId,
    onSelect: setSelectedId,
    onBack: () => go("picker"),
    narrow,
    version,
  };

  function renderScreen() {
    if (screen === "picker") {
      return <Picker {...common} onSelect={selectTask} />;
    }
    if (screen === "more") {
      return <More {...common} onSelect={selectTask} onBack={() => go("picker")} />;
    }
    if (screen === "review") {
      return (
        <Review
          {...common}
          steps={views}
          findings={findings}
          onBack={() => go("picker")}
          onContinue={continueFromReview}
        />
      );
    }
    if (screen === "confirm") {
      return (
        <Confirm
          {...common}
          steps={views}
          findings={findings}
          onBack={() => go("review")}
          onConfirm={confirmRun}
        />
      );
    }
    if (screen === "progress") {
      return <Progress {...common} steps={views} logs={logs} />;
    }
    return (
      <Summary
        {...common}
        steps={views}
        verification={views.every((view) => view.status === "ok") ? "passed" : "failed"}
        onQuit={quit}
      />
    );
  }

  function footer(): string {
    if (screen === "picker") {
      return narrow
        ? "Enter select - m more - ? help - q quit"
        : "Up/Down move - Enter select - m more - ? help - q quit";
    }
    if (screen === "more") {
      return narrow
        ? "Type search - Esc back - ? help"
        : "Type to search - Up/Down move - Enter select - Esc back - ? help";
    }
    if (screen === "review") {
      return narrow
        ? "Enter next - r run - Esc back - ? help"
        : "Up/Down select - Enter next - r run - Esc back - ? help - q quit";
    }
    if (screen === "confirm") {
      return narrow
        ? "y/a approve - Esc back - ? help"
        : "y/a approve - Esc back - ? help - q quit";
    }
    if (screen === "progress") {
      return narrow ? "a abort - ? help - q quit" : "a or Esc abort - ? help - q quit";
    }
    return narrow ? "Enter picker - q quit" : "Enter picker - Esc picker - q quit";
  }

  return (
    <Box flexDirection="column">
      <Chrome version={version} stepCount={plan.steps.length} narrow={narrow} />
      <Text dimColor>
        step {SCREEN_STEP[screen]} of {SCREEN_TOTAL}
        {runEnabled ? "" : " - dry-run"}
        {running ? " - running" : ""}
      </Text>

      <Box flexDirection="column" marginTop={1}>
        {help ? (
          <>
            <HelpOverlay narrow={narrow} onClose={() => setHelp(false)} />
            <Box marginTop={1}>
              <Text dimColor>m more - a approve or abort - ctrl+c quit</Text>
            </Box>
          </>
        ) : (
          renderScreen()
        )}
      </Box>

      {notice !== "" ? (
        <Box marginTop={1}>
          <Text color="yellow">{notice}</Text>
        </Box>
      ) : null}

      {help ? null : (
        <Box marginTop={1}>
          <Text dimColor>{footer()}</Text>
        </Box>
      )}
    </Box>
  );
}

export default App;
