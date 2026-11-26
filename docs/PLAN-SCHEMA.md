# Plan schema

This page documents version 1 plans for the combined wrapper.
A plan is one JSON file.
It describes one multi-step media job.
The core validates a plan before a run.

## Plan fields

| Field      | Type   | Required | Notes                            |
| ---------- | ------ | -------- | -------------------------------- |
| `version`  | `1`    | yes      | Schema version.                  |
| `id`       | string | yes      | Stable plan id.                  |
| `name`     | string | yes      | Human-readable name.             |
| `shell`    | string | yes      | `posix`, `powershell`, or `cmd`. |
| `vars`     | object | no       | String values for placeholders.  |
| `defaults` | object | no       | Default guard values.            |
| `steps`    | array  | yes      | The step list.                   |

Version 1 plans run on Linux with the `posix` shell.
The runner supports only the `posix` shell.

### defaults

The CLI ignores `defaults.force` and `defaults.unsafe`.
Use `--force` and `--unsafe` to change guard behavior.

## vars

`vars` maps names to string values.
Use `{{name}}` in an argument to insert a value.
The binder also accepts `<name>` and converts it to `{{name}}`.
The binder applies to `name`, `value`, `values`, and `alias`.
An unknown name stays as `{{name}}` in the output.
The adapter reports `E_UNBOUND_VAR` for each unknown name.
That error blocks the step.

Example:

```json
"vars": {
  "sourceUrl": "https://example.com/video",
  "outputPath": "out"
}
```

## steps

Each step is one command for `yt-dlp` or `ffmpeg`.

| Field       | Type     | Required | Notes                          |
| ----------- | -------- | -------- | ------------------------------ |
| `id`        | string   | yes      | Must be unique in the plan.    |
| `tool`      | string   | yes      | `yt-dlp` or `ffmpeg`.          |
| `recipeId`  | string   | no       | Recipe that produced the step. |
| `args`      | array    | yes      | Argument list.                 |
| `inputs`    | string[] | no       | Input paths for the step.      |
| `outputs`   | string[] | no       | Expected output paths.         |
| `dependsOn` | string[] | no       | Step ids that must run first.  |
| `unsafe`    | boolean  | no       | The step needs `--unsafe`.     |
| `verify`    | object   | no       | Post-run output check.         |

`recipeId` is metadata.
The runner does not look it up.

### args

Each entry has a `kind`, a `name`, and optional value fields.

| Field    | Type     | Notes                            |
| -------- | -------- | -------------------------------- |
| `kind`   | string   | `flag`, `option`, or `value`.    |
| `name`   | string   | Flag name or operand value.      |
| `value`  | string   | One value for an option.         |
| `values` | string[] | Repeatable values for an option. |
| `alias`  | string   | Alternate flag name.             |

`flag` adds only the flag.
`option` adds the flag and its value.
`value` adds only an operand.
For `option`, `values` takes priority over `value`.
The renderer repeats the flag for each item in `values`.
A name without a dash gets `--` when it has two or more characters.
A one-character name gets `-`.
An `alias` replaces `name`.

### outputs

`outputs` lists the files that the step should write.
The overwrite guard checks each entry.
A later step can list the same path in `inputs`.
Use a `{{var}}` placeholder for a path that changes per run.
The guard checks each output that exists.
A step with an existing output needs `--force`.

### dependsOn

`dependsOn` lists step ids that must succeed first.
Each id must exist in the plan.
A missing id gives `E_MISSING_DEP`.
A dependency cycle gives `E_CYCLE`.
Topological order sets the run order.
Version 1 runs the steps one at a time.

### verify

| Field            | Type     | Notes                                   |
| ---------------- | -------- | --------------------------------------- |
| `command`        | string   | Command to run after the step.          |
| `exists`         | string[] | Paths that must exist and be non-empty. |
| `expectExitCode` | integer  | Required step exit code.                |

If `verify` is absent, the adapter supplies a default.
The yt-dlp default checks the step outputs.
The ffmpeg default probes the first output with `ffprobe`.
If there are no outputs, the default expects exit code 0.
A failed check marks the step as failed.

## Guards

The guard pass runs after schema and dependency checks.
An error finding blocks the step.
The CLI passes explicit guard flags. Plan defaults do not enable guards.

| Guard         | Code              | Rule                                              |
| ------------- | ----------------- | ------------------------------------------------- |
| Overwrite     | `E_OVERWRITE`     | Blocks an existing output unless `force` is true. |
| Unsafe        | `E_UNSAFE`        | Blocks an unsafe step unless `unsafe` is true.    |
| Unbound var   | `E_BLOCKED`       | Blocks a remaining placeholder in any field.      |
| Tool mismatch | `E_TOOL_MISMATCH` | Blocks a step for the wrong adapter.              |
| Missing dep   | `E_MISSING_DEP`   | Blocks an unknown `dependsOn` id.                 |
| Cycle         | `E_CYCLE`         | Blocks a dependency cycle.                        |

The yt-dlp adapter marks `exec`, `exec-before-download`, and `postprocessor-args` as unsafe.
It also marks an output to `-` as unsafe.
The ffmpeg adapter marks network inputs, HLS or DASH output, and script filters as unsafe.
Those steps need `--unsafe`.

## Execution modes

| Mode              | Behavior                                                      |
| ----------------- | ------------------------------------------------------------- |
| Dry-run (default) | Validate, bind, render, and report guards. No process starts. |
| `--run`           | Execute after the checks pass. Ask for confirmation.          |
| `--run --yes`     | Execute without the confirmation prompt.                      |

A guard still applies with `--yes`.
`--yes` skips only the prompt.

## Example: download then transcode

The plan downloads a video with `yt-dlp`.
Then it transcodes the file to H.264 MP4 with `ffmpeg`.

```json
{
  "version": 1,
  "id": "download-transcode",
  "name": "Download and transcode",
  "shell": "posix",
  "vars": {
    "sourceUrl": "https://example.com/video",
    "outputPath": "out"
  },
  "defaults": {
    "force": false,
    "unsafe": false
  },
  "steps": [
    {
      "id": "download",
      "tool": "yt-dlp",
      "recipeId": "best-video",
      "args": [
        { "kind": "option", "name": "-f", "value": "bv*+ba/b" },
        { "kind": "option", "name": "--merge-output-format", "value": "mkv" },
        {
          "kind": "option",
          "name": "-o",
          "values": ["{{outputPath}}/source.%(ext)s"]
        },
        { "kind": "flag", "name": "--no-playlist" },
        { "kind": "value", "name": "{{sourceUrl}}" }
      ],
      "outputs": ["{{outputPath}}/source.mkv"],
      "verify": { "exists": ["{{outputPath}}/source.mkv"] }
    },
    {
      "id": "transcode",
      "tool": "ffmpeg",
      "recipeId": "web-h264",
      "args": [
        { "kind": "flag", "name": "-hide_banner" },
        { "kind": "option", "name": "-i", "value": "{{outputPath}}/source.mkv" },
        { "kind": "option", "name": "-c:v", "value": "libx264" },
        { "kind": "option", "name": "-preset", "value": "medium" },
        { "kind": "option", "name": "-crf", "value": "23" },
        { "kind": "option", "name": "-pix_fmt", "value": "yuv420p" },
        { "kind": "option", "name": "-c:a", "value": "aac" },
        { "kind": "option", "name": "-b:a", "value": "128k" },
        { "kind": "option", "name": "-movflags", "value": "+faststart" },
        { "kind": "value", "name": "{{outputPath}}/web.mp4" }
      ],
      "inputs": ["{{outputPath}}/source.mkv"],
      "outputs": ["{{outputPath}}/web.mp4"],
      "dependsOn": ["download"],
      "verify": { "exists": ["{{outputPath}}/web.mp4"] }
    }
  ]
}
```

The download step writes `out/source.mkv`.
The transcode step depends on the download step.
The transcode step reads the download output.
Both steps verify that their output exists.
The outputs trigger the overwrite guard.
Pass `--force` after you check the paths.

Rendered commands:

```sh
yt-dlp -f 'bv*+ba/b' --merge-output-format mkv -o 'out/source.%(ext)s' --no-playlist https://example.com/video
ffmpeg -hide_banner -i out/source.mkv -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 128k -movflags +faststart out/web.mp4
```
