#!/usr/bin/env bash
set -euo pipefail

# Capture the README demo from the real TUI. Requires vhs, ttyd, and ffmpeg.
root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

if ! command -v vhs >/dev/null 2>&1; then
	echo "error: vhs is required" >&2
	exit 1
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
	echo "error: ffmpeg is required" >&2
	exit 1
fi

bash scripts/package-tui.sh >/dev/null
mkdir -p docs/images
vhs docs/demo.tape

# Extract a still frame of the picker for fast loading.
ffmpeg -y -loglevel error -i docs/images/demo.gif -vf "select=eq(n\,12)" -frames:v 1 docs/images/picker.png

echo "wrote docs/images/demo.gif"
echo "wrote docs/images/picker.png"
