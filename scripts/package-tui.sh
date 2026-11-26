#!/usr/bin/env bash
set -euo pipefail

# Resolve the repository root from this script's location.
repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

dist_dir="$repo_root/dist"
entry="$repo_root/bin/combined-wrapper.ts"
stub_dir="$repo_root/node_modules/react-devtools-core"

# Ink imports react-devtools-core. Add a stub when the package is absent.
if [ ! -d "$stub_dir" ]; then
	mkdir -p "$stub_dir"
	cat >"$stub_dir/package.json" <<'JSON'
{
  "name": "react-devtools-core",
  "version": "0.0.0-stub",
  "private": true,
  "main": "index.js"
}
JSON
	cat >"$stub_dir/index.js" <<'JS'
export default {
  initialize() {},
  connectToDevTools() {},
};
JS
fi

if [ ! -f "$entry" ]; then
	echo "error: missing entry point: bin/combined-wrapper.ts" >&2
	exit 1
fi

mkdir -p "$dist_dir"

build() {
	local target="$1"
	local out="$dist_dir/combined-wrapper-$target"
	echo "building $target"
	bun build --compile --target="$target" "$entry" --outfile "$out"
}

build bun-linux-x64
build bun-linux-arm64

cd "$dist_dir"
sha256sum combined-wrapper-bun-linux-x64 combined-wrapper-bun-linux-arm64
