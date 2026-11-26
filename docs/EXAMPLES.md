# Examples

This page shows each sample plan in `examples/plans`.
Each plan is a complete version 1 JSON file.
Run every command from the repository root.

## Dry-run by default

The tool starts in dry-run mode.
It validates the plan, binds placeholders, and renders commands.
It starts no process.
`--run` allows execution.
`--print` writes the commands and exits.

## Print commands

`--print` needs `--plan`.
It validates the plan and resolves each step.
It writes one shell command per step to stdout.
It never opens the text user interface (TUI). It never starts a process.

```sh
bun bin/combined-wrapper.ts --plan examples/plans/download-transcode.json --print
```

If the plan has an error, the tool prints the finding and exits with code 2.

## Run a plan

`--run` enables execution and opens the TUI.
Review the commands before you confirm.
`--yes` skips the confirmation prompt.
`--force` clears the overwrite guard for declared outputs.
`--unsafe` allows steps that need unsafe mode.
A guard still applies with `--yes`.

Each step verifies its output after it runs.
The yt-dlp adapter checks the declared output paths.
The ffmpeg adapter probes the first output with `ffprobe`.
A failed check marks the step as failed and stops the plan.

Add `--yes` to any `--run` command to skip the prompt.

## download-transcode

Downloads a video with `yt-dlp`.
Then transcodes it to H.264 MP4 with `ffmpeg`.

```sh
bun bin/combined-wrapper.ts --plan examples/plans/download-transcode.json --print
bun bin/combined-wrapper.ts --plan examples/plans/download-transcode.json --run --force
```

`--print` output:

```sh
yt-dlp -f 'bv*+ba/b' --merge-output-format mkv -o 'out/source.%(ext)s' --no-playlist https://example.com/video
ffmpeg -hide_banner -i out/source.mkv -c:v libx264 -preset medium -crf 23 -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart out/web.mp4
```

Outputs: `out/source.mkv` and `out/web.mp4`.

## download-audio

Downloads audio and converts it to WAV.

```sh
bun bin/combined-wrapper.ts --plan examples/plans/download-audio.json --print
bun bin/combined-wrapper.ts --plan examples/plans/download-audio.json --run --force
```

`--print` output:

```sh
yt-dlp --extract-audio --audio-format m4a --audio-quality 0 -o 'out/source.%(ext)s' https://example.com/audio
ffmpeg -hide_banner -i out/source.m4a -vn -c:a pcm_s16le -ar 48000 -ac 2 out/audio.wav
```

Outputs: `out/source.m4a` and `out/audio.wav`.

## convert-web

Scales a local file to 1080p and encodes a web MP4.
Put the input file at `in/source.mkv`.

```sh
bun bin/combined-wrapper.ts --plan examples/plans/convert-web.json --print
bun bin/combined-wrapper.ts --plan examples/plans/convert-web.json --run --force
```

`--print` output:

```sh
ffmpeg -hide_banner -i in/source.mkv -vf scale=-2:1080 -c:v libx264 -preset medium -crf 21 -c:a copy out/scaled.mp4
ffmpeg -hide_banner -i out/scaled.mp4 -c:v libx264 -preset medium -crf 23 -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart out/web.mp4
```

Outputs: `out/scaled.mp4` and `out/web.mp4`.
Create `out` before the run:

```sh
mkdir -p out
```

## trim-clip

Copies a 60 second clip from a local file.
Put the input file at `in/source.mkv`.

```sh
bun bin/combined-wrapper.ts --plan examples/plans/trim-clip.json --print
bun bin/combined-wrapper.ts --plan examples/plans/trim-clip.json --run --force
```

`--print` output:

```sh
ffmpeg -hide_banner -ss 00:00:10 -i in/source.mkv -t 60 -c copy -avoid_negative_ts make_zero out/clip.mp4
```

Output: `out/clip.mp4`.
Create `out` before the run:

```sh
mkdir -p out
```

## list-formats

Lists the formats that `yt-dlp` reports for a URL.
This plan declares no output file.
The run needs no `--force`.

```sh
bun bin/combined-wrapper.ts --plan examples/plans/list-formats.json --print
bun bin/combined-wrapper.ts --plan examples/plans/list-formats.json --run
```

`--print` output:

```sh
yt-dlp --list-formats --no-warnings https://example.com/video
```

Verification expects exit code 0.

## Change a value

Each plan puts paths and URLs in `vars`.
Edit the JSON file to change a value.
Run `--print` again to check the new commands.

Read [PLAN-SCHEMA.md](PLAN-SCHEMA.md) for every plan field.
