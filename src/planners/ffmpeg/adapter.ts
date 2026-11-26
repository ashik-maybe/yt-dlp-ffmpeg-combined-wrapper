import { createAdapter } from "../../contracts/adapter.js";
import type { StepResolution, ToolAdapter } from "../../contracts/adapter.js";
import type { PlanArg, Step, VerifySpec } from "../../core/index.js";

const STREAM_FORMATS: readonly string[] = ["hls", "dash"];
const FILTER_SCRIPT_OPTIONS: readonly string[] = ["filter_script", "filter_complex_script"];

const NETWORK_SCHEME_RE =
  /(?:^|[^a-z0-9+.-])(?:rtmps|rtmp|hls|dash|srt)(?:\+[a-z0-9.+-]+)?:\/\//i;
const STREAM_EXTENSION_RE = /\.(?:m3u8|mpd)(?:[?#]|$)/i;

const PROBE_ARGS: readonly string[] = [
  "-v",
  "error",
  "-show_entries",
  "format=format_name",
  "-of",
  "csv=p=0",
];

function stripDashes(name: string): string {
  return name.replace(/^-+/, "");
}

function optionName(arg: PlanArg): string {
  const name = stripDashes(arg.alias ?? arg.name);
  return name.split(":")[0].toLowerCase();
}

function argTexts(arg: PlanArg): readonly string[] {
  const texts: string[] = [arg.name];
  if (arg.alias !== undefined) texts.push(arg.alias);
  if (arg.value !== undefined) texts.push(arg.value);
  if (arg.values !== undefined) texts.push(...arg.values);
  return texts;
}

function argValues(arg: PlanArg): readonly string[] {
  if (arg.values !== undefined && arg.values.length > 0) return arg.values;
  if (arg.value !== undefined) return [arg.value];
  return [];
}

function isStreamFormat(arg: PlanArg): boolean {
  const name = optionName(arg);
  if (name === "f" || name === "format") {
    return argValues(arg).some((value) => STREAM_FORMATS.includes(value.toLowerCase()));
  }
  return name.startsWith("hls_") || name.startsWith("dash_");
}

function isFilterScript(arg: PlanArg): boolean {
  return FILTER_SCRIPT_OPTIONS.includes(optionName(arg));
}

function isUnsafeArg(arg: PlanArg): boolean {
  if (isFilterScript(arg) || isStreamFormat(arg)) return true;
  return argTexts(arg).some(
    (text) => NETWORK_SCHEME_RE.test(text) || STREAM_EXTENSION_RE.test(text),
  );
}

function quoteShell(value: string): string {
  if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(value)) return value;
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function probeCommand(output: string): string {
  return ["ffprobe", ...PROBE_ARGS, quoteShell(output)].join(" ");
}

const base = createAdapter("ffmpeg");

/**
 * FFmpeg planner. Step args carry recipe args. planFromStep binds vars into PlanArg values.
 */
export const ffmpegAdapter: ToolAdapter = {
  tool: "ffmpeg",
  planFromStep(step: Step, vars: Readonly<Record<string, string>>): StepResolution {
    return base.planFromStep(step, vars);
  },
  requiresUnsafe(step: Step): boolean {
    if (step.unsafe === true) return true;
    return step.args.some(isUnsafeArg);
  },
  defaultVerify(step: Step): VerifySpec {
    if (step.verify !== undefined) return step.verify;
    const output = step.outputs?.[0];
    if (output === undefined) return { expectExitCode: 0 };
    return { command: probeCommand(output), expectExitCode: 0 };
  },
};
