# Release v1.0.0

This guide tags `v1.0.0` and publishes the Linux binaries.

## Before you tag

- Merge all v1.0.0 changes into `main`.
- Confirm `CHANGELOG.md` has the `1.0.0` section.
- Confirm `bun run ci` passes on `main`.
- Confirm `.github/workflows/tui-release.yml` is on `main`.
- Confirm the repository allows workflow write access.

## Tag and push

Create an annotated tag on the release commit:

```sh
git switch main
git pull --ff-only
git tag -a v1.0.0 -m "v1.0.0"
git push origin v1.0.0
```

The tag push starts the `TUI release` workflow.
Do not move or reuse the tag after publication.

## Release workflow steps

The `TUI release` workflow runs when you push a `v*` tag.
It also supports manual start through `workflow_dispatch`.
A manual run on a branch builds and tests the binaries.
A manual run on a branch creates no release.
It also skips the version stamp.

1. Check out the tagged commit.
2. Install Bun 1.4.5.
3. Install dependencies with `bun install --frozen-lockfile`.
4. Run the full gate with `bun run ci`.
5. Stamp `src/cli/version.ts` with the tag version.
6. Build x64 and arm64 binaries with `scripts/package-tui.sh`.
7. Install QEMU for the arm64 smoke test.
8. Smoke test the x64 binary with `--version` and `--help`.
9. Smoke test print mode with `examples/plans/download-transcode.json`.
10. Smoke test the arm64 binary with `--version`.
11. Write `combined-wrapper-checksums.txt` with SHA256 sums.
12. Create the GitHub release with both binaries and the checksum file.

## Release assets

- `combined-wrapper-bun-linux-x64`
- `combined-wrapper-bun-linux-arm64`
- `combined-wrapper-checksums.txt`

## Verify a download

Choose the asset that matches your machine.
Download all three assets into one directory.
Keep the asset file names unchanged.
Run the checksum check:

```sh
sha256sum --check combined-wrapper-checksums.txt
```

Expected output:

```text
combined-wrapper-bun-linux-x64: OK
combined-wrapper-bun-linux-arm64: OK
```

Make the selected binary executable:

```sh
chmod +x combined-wrapper-bun-linux-x64
```

Run a smoke test:

```sh
./combined-wrapper-bun-linux-x64 --version
./combined-wrapper-bun-linux-x64 --help
```

Print a sample plan:

```sh
./combined-wrapper-bun-linux-x64 --print --plan examples/plans/download-transcode.json
```

The sample plan needs the `examples/` directory from the repository.
Or pass any local plan path.

## If the workflow fails

Read the failed job log before you change the tag.
Fix the problem on `main` and run the gate again.
Delete the broken release in GitHub before you delete its tag.
Delete the local and remote tag, then tag the fixed commit.

```sh
git tag -d v1.0.0
git push origin :refs/tags/v1.0.0
git tag -a v1.0.0 -m "v1.0.0"
git push origin v1.0.0
```

Do not move a published tag unless its release is broken.
