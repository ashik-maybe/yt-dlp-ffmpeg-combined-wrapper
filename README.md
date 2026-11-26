# Combined yt-dlp and ffmpeg wrapper

One tool for multi-step media jobs.
It plans and runs commands for `yt-dlp` and `ffmpeg`.
The tool uses a text user interface (TUI).
It runs in a terminal on Linux.
It does not upload your media.

## Install

Download the Linux x64 or arm64 binary from the releases.
Or install the dependencies from source:

```sh
bun install --frozen-lockfile
```

Install `yt-dlp`, `ffmpeg`, and `ffprobe`.
The tool calls these binaries during a run.
Put each binary in your `PATH`.

## Quick start

Start the tool:

```sh
bun bin/combined-wrapper.ts
```

Pick a plan in the plan picker.
The first pass is a dry-run.
It validates the plan and shows every command.
It does not start a process.

Allow execution with a confirmation prompt:

```sh
bun bin/combined-wrapper.ts --run
```

Run without a prompt:

```sh
bun bin/combined-wrapper.ts --run --yes
```

Read [docs/PLAN-SCHEMA.md](docs/PLAN-SCHEMA.md) to write a plan.

## How it works

One plan holds one or more steps.
Each step uses `yt-dlp` or `ffmpeg`.
A step lists its arguments, outputs, and dependencies.

The tool checks the plan before it runs:

- Schema version and field types.
- Step ids and dependency cycles.
- Placeholder binding from `vars`.
- Rendered command text.
- Guard findings.

A dry-run stops after these checks.
`--run` executes the steps in dependency order.
A failed step stops the plan.
Each step can verify its outputs after it runs.
A later step can read an output from an earlier step.

See [docs/PLAN-SCHEMA.md](docs/PLAN-SCHEMA.md) for the full plan format.

## Keys

| Key              | Screen  | Action                           |
| ---------------- | ------- | -------------------------------- |
| `Up/Down`, `j/k` | Any     | Move the selection.              |
| `Enter`          | Picker  | Load the selected plan.          |
| `Enter`          | Review  | Continue to the next screen.     |
| `Space`          | Picker  | Toggle a task.                   |
| `r`              | Review  | Start the plan in `--run` mode.  |
| `y`              | Confirm | Confirm execution.               |
| `n`              | Confirm | Cancel execution.                |
| `?`              | Any     | Open or close help.              |
| `Esc`            | Any     | Go back or close help.           |
| `q`              | Any     | Quit.                            |
| `Ctrl+C`         | Any     | Abort the current step and exit. |

## Flags

| Flag       | Effect                                |
| ---------- | ------------------------------------- |
| `--run`    | Allow step execution. Off by default. |
| `--yes`    | Skip the confirmation prompt.         |
| `--force`  | Allow output overwrite.               |
| `--unsafe` | Allow steps that need unsafe mode.    |

`--run` is the only way to start a process.
`--yes` skips the prompt but not a guard.
`--force` and `--unsafe` never turn on by themselves.

## Safety

The tool does not execute a command by default.
Every plan starts as a dry-run.
`--run` enables execution.
`--yes` removes the confirmation prompt.
The overwrite guard blocks every declared output unless `--force` is set.
A step marked `unsafe` needs `--unsafe`.
The yt-dlp adapter marks `exec`, `exec-before-download`, and `postprocessor-args` as unsafe.
The ffmpeg adapter marks network inputs and script filters as unsafe.
The tool binds placeholders before execution.
An unbound placeholder blocks the step with `E_UNBOUND_VAR`.
The runner uses argv arrays and does not invoke a shell.
Verification checks each output after its step.

## Limits

The tool runs on Linux only.
The v1 plan shell is `posix`.
Steps run one at a time in dependency order.
The tool does not retry a failed step.
The tool does not pick new flags after a failure.
Raw arguments have no correctness guarantee.
Download and transcode success is not guaranteed.
The overwrite guard cannot prove that a file is absent.
`yt-dlp`, `ffmpeg`, and `ffprobe` must be installed.

## Development

Repository layout:

- `bin/`: TUI entry point.
- `src/core/`: schema, DAG checks, binding, guards, and rendering.
- `src/contracts/`: tool adapter interface and example plan.
- `src/planners/`: yt-dlp and ffmpeg adapters.
- `src/runner/`: process control and output verification.
- `src/tui/`: screens, components, and key handling.
- `tests/`: unit, runner, CLI, and TUI tests.
- `scripts/`: checks and packaging.
- `docs/`: reference documentation.

Run the full gate:

```sh
bun run ci
```

Run only the TUI tests:

```sh
bun run tui:test
```

Check this README:

```sh
bun run readme:check
```

Build the Linux binaries:

```sh
bash scripts/package-tui.sh
```

Read [docs/PLAN-SCHEMA.md](docs/PLAN-SCHEMA.md) before you change the plan format.
