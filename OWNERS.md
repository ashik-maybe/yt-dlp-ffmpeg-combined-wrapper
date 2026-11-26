# OWNERS

One owner writes one file set. An owner may import another owner's file. An owner may not edit it.

- Agent A owns the repo root: `package.json`, `tsconfig.json`, `vitest.config.ts`, `AGENTS.md`, `OWNERS.md`, `.gitignore`, and `bun.lock`.
- Agent B owns `src/core`, `src/contracts`, and `tests/core`.
- Agent C owns `src/planners/yt-dlp`, `tests/planners/yt-dlp`, and `tests/planners/golden.test.ts`.
- Agent D owns `src/planners/ffmpeg` and `tests/planners/ffmpeg`.
- Agent E owns `src/recipes`, `src/data`, `src/spec`, `examples/plans`, `tests/data`, `tests/examples`, and `scripts/spec-check.mjs`.
- Agent F owns `src/runner`, `tests/runner`, and `tests/integration`.
- Agent G owns `src/tui` and `tests/tui`.
- Agent H owns `bin`, `src/cli`, `tests/cli`, and `scripts/package-tui.sh`.
- Agent I owns `README.md`, `docs`, `CHANGELOG.md`, `RELEASE.md`, `scripts/readme-check.mjs`, `scripts/agents-check.mjs`, `scripts/capture-demo.sh`, and `.github/workflows`.
- Agent J reviews and edits nothing.
