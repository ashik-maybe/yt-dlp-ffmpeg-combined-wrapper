# AGENTS

## Purpose

This repository owns one combined terminal user interface (TUI) for `yt-dlp` and `ffmpeg`.
A version 1 JSON plan describes one multi-step media job.
The TUI validates the plan, binds variables, renders each command, and runs the steps in dependency order.
Every plan starts as a dry-run.
Only `--run` starts a process.
The tool runs on Linux and uploads nothing.
Read [README.md](README.md) for install steps, keys, and flags.

## Start here

```sh
bun install --frozen-lockfile
bun bin/combined-wrapper.ts --plan examples/plans/download-transcode.json
bun run ci
bun run tui:test
bash scripts/package-tui.sh
```

The second command opens the dry-run TUI in a terminal.
The third command runs the full gate.
The last command writes both Linux binaries to `dist/`.

## Verify

Run the narrowest check first.
Use `bun run test -- tests/<path>` for one test file.
Use `bun run typecheck` after a type change.
Use `bun run lint` after a code change.
Do not use `bun run format` as a check.
It writes files.
Use `bun run format:check` instead.
The full gate is `bun run ci`.
It runs lint, format check, typecheck, spec check, README check, and every test.
Run the full gate last.
Report the exact command and its output.

## Architecture

Flow: `bin` to `src/cli` to `src/tui` to `src/core`.
The planners and runner use `src/data` and `src/spec`.

- `bin/`: the single entry point. It parses flags, loads the plan, and starts print mode or the TUI.
- `src/cli/`: flags, usage text, version, and print-mode rendering.
- `src/tui/`: the Ink app, screens, components, theme, global keys, and step views.
- `src/core/`: plan types, schema, DAG checks, binding, guards, and command rendering.
- `src/contracts/`: the adapter interface and fixed fixtures.
- `src/planners/`: the `yt-dlp` and `ffmpeg` adapters. Each binds a step and marks unsafe arguments.
- `src/runner/`: process start, progress parse, output verification, and plan execution.
- `src/data/`: recipe JSON and the loader.
- `src/recipes/`: the curated picker order and hint text.
- `src/spec/`: pinned options, filters, encoders, versions, and the ffmpeg manifest.
- `tests/`: unit, data, planner, runner, CLI, TUI, example, and docs tests.
- `scripts/`: checks, demo capture, and packaging.
- `examples/plans/`: five sample plans.
- `docs/`: schema, examples, and demo images.

## Invariants

- Never execute by default. A process starts only with `--run`.
- Bind variables before guard checks. An unbound name gives `E_UNBOUND_VAR` and blocks the step.
- Start tool commands with argv arrays, not a shell. Verification commands use `/bin/sh`.
- Verify outputs after each step. A failed check stops the plan.
- Keep all TUI text ASCII. The ASCII test scans every TUI file.
- Use one accent color. `src/tui/theme.ts` defines `ACCENT = "cyan"`.
- Do not add emoji. Do not add decorative Unicode.

## Add a recipe

A recipe has `id`, `name`, `tool`, `args`, and optional `confidence`.

- Add a yt-dlp recipe to `src/data/yt-dlp/recipes.json`. This file holds one array.
- Add an ffmpeg recipe as `src/data/ffmpeg/recipes/<id>.json`. The file name must equal the id.
- Add an ffmpeg picker or more entry to `src/data/ffmpeg/catalog.json`. The catalog test requires each recipe exactly once.
- Add any new flag to `src/spec/ffmpeg/options.json`. Add any new filter to `src/spec/ffmpeg/filters.json`. Add any new yt-dlp option to `src/spec/yt-dlp/options.json`.
- Add the id to `CURATED` in `src/recipes/index.ts` if it belongs in the picker. Add a `HINTS` entry for custom hint text.
- The loader `src/data/index.ts` reads the folder. A new ffmpeg file needs no loader change.
- Update the counts in `tests/data/loader.test.ts`.
- Update `tests/data/ffmpeg/recipes.test.ts` or `tests/data/yt-dlp/recipes.test.ts`.
- Update `tests/data/ffmpeg/catalog.test.ts` when you edit the catalog.
- Run `bun run spec:check` and the data tests.

## Add a plan

Read [docs/PLAN-SCHEMA.md](docs/PLAN-SCHEMA.md) first.

1. Copy a sample from `examples/plans/`.
2. Set `version` to 1. Set `id`, `name`, `shell`, `vars`, and `steps`.
3. Set each step `recipeId` to a real id from `src/data`. Use `dependsOn` for order.
4. Run `bun bin/combined-wrapper.ts --plan <file> --print`. Then add the plan to [docs/EXAMPLES.md](docs/EXAMPLES.md) and update the count in `tests/examples/validate.test.ts`.

## TUI rules

- Use real handlers. Every `useInput` handler changes state or calls a callback. Delete a key when you delete its action.
- Register every handled key in `HELP_KEYS` in `src/tui/components/help-overlay.tsx`. Repeat the main keys in the screen footer.
- Support the narrow layout. `isNarrow` is true below 80 columns. Hide hints and the log tail. Shorten the footer.
- Draw the progress bar with `#` and `-`. Use 20 cells on wide terminals and 10 on narrow terminals. Show percent and `done/total`.
- Keep global keys in `src/tui/app.tsx`. Screen files handle local keys only.
- Leave no stale key or stale footer entry.

## Pipelines

- CI: `.github/workflows/ci.yml` runs on every push and pull request. It installs Bun 1.4.5, runs the gate, builds both binaries, and smoke tests x64 and print mode.
- Tag flow: push a `v*` tag. `.github/workflows/tui-release.yml` runs the gate, builds, smoke tests, writes checksums, and creates the GitHub release.
- Version stamping: the release workflow rewrites `VERSION` in `src/cli/version.ts` from the tag. A manual branch run skips the stamp.
- arm64 smoke: the workflow installs QEMU and runs the arm64 binary with `--version` under `qemu-aarch64`.
- Drift PR: `.github/workflows/drift.yml` runs each Monday at 09:00 UTC. It refreshes `src/spec` from upstream and opens a `chore/drift-spec` PR after the gate passes.

## Pitfalls

- `bun run format` writes files. Use `bun run format:check` for a read-only check.
- `spec-check` counts each object with `id`, `tool`, and `args` under `src/data` and `src/spec`. Test fixtures and catalog groups can change the total. The current total is 35 recipes.
- `scripts/capture-demo.sh` needs `vhs`, `ttyd`, and `ffmpeg`. It builds the binary first. The demo GIF must stay under 5 MB.
- A failed release tag must be recreated. Delete the broken release first. Delete the local and remote tag. Tag the fixed commit again.
- Do not edit `bun.lock` or any `package-lock.json` by hand. Run `bun install`.

## Ownership

Read [OWNERS.md](OWNERS.md) before you edit.
Change only the paths that you own.
Ask the owner before you cross a boundary.
Reviewers edit nothing.

## Commits

Use Conventional Commits, for example `docs: add AGENTS guide`.
Keep one slice per commit.
Stage only your files.
Do not mix formatting with behavior changes.
Do not commit `dist/`, `node_modules`, or `.cache`.
