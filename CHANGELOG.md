# Changelog

All notable changes to this project are documented here.

## [1.0.0] - 2026-11-26

### Added

- **One combined TUI.** A single Ink interface plans and runs yt-dlp and ffmpeg jobs.
- **Guided screens.** Picker, more, review, confirm, progress, and summary cover each run.
- **Two tool planners.** Separate yt-dlp and ffmpeg adapters bind variables and mark unsafe arguments.
- **Recipe catalogs.** Bundled recipes cover common download, audio, and transcode jobs.
- **Multi-step JSON plans.** Version 1 plans define steps, variables, outputs, and `dependsOn` links.
- **Dependency checks.** The validator rejects duplicate ids, missing dependencies, and cycles.
- **Dry-run default.** Every plan validates, binds, and renders before any process starts.
- **Safety flags.** `--run` allows execution. `--yes`, `--force`, and `--unsafe` relax specific guards.
- **Guard findings.** Overwrite, unsafe, placeholder, tool mismatch, dependency, and cycle errors block steps.
- **Exit codes.** Usage and plan errors exit 2. The CLI exits 0 on success.
- **Step exit codes.** Each step records its exit code. A non-zero code stops the plan.
- **Output verification.** Plans check exit codes, non-empty outputs, or a custom command.
- **Default verification.** yt-dlp checks declared outputs. ffmpeg probes the first output with ffprobe.
- **Print mode.** `--print --plan <path>` prints rendered commands and exits.
- **Sample plans.** Five plans in `examples/plans/` cover download, audio, web, formats, and trim.
- **Linux binaries.** Release assets provide x64 and arm64 builds with SHA256 checksums.
