---
name: github-release-updater
description: Publish tech-cc-hub desktop app updates through electron-updater, GitHub Releases, and GitHub Actions. Use when the user asks to release a new version, publish an update, create a GitHub Release, trigger auto-update metadata, or package macOS/Windows desktop builds without deploying a server.
---

# GitHub Release Updater

## Purpose

Use this skill to release `tech-cc-hub` desktop updates through GitHub only:

- no custom update server
- GitHub Actions builds installers
- GitHub Releases hosts installers and update metadata
- `electron-updater` checks GitHub Releases from the desktop client

## Non-negotiable rules

- Do not release from a dirty worktree unless the user explicitly approves it.
- Do not manually edit or reuse an existing release tag.
- Do not publish Windows production builds from macOS by default; use GitHub Actions `windows-latest`.
- Do not use the Windows `portable` target as the auto-update path; use `nsis`.
- Keep macOS `zip` target enabled because updater metadata depends on it.
- If QA was not run in the current turn, say that plainly before release.

## Release command

Preferred release entry:

```bash
npm run release:github -- patch
```

Other accepted forms:

```bash
npm run release:github -- minor
npm run release:github -- major
npm run release:github -- v0.1.2
npm run release:github -- patch --dry-run
npm run release:github -- patch --no-push
```

## What the script does

The script `scripts/github-release.mjs`:

1. Checks the Git repository and origin remote.
2. Requires a clean worktree by default.
3. Computes the next version.
4. Runs `npm version <version> --no-git-tag-version`.
5. Commits `package.json` and `package-lock.json`.
6. Creates annotated tag `vX.Y.Z`.
7. Pushes the branch and tag.
8. Lets `.github/workflows/release.yml` build and publish Release assets.

## Expected Release assets

After the workflow finishes, check:

```text
https://github.com/lst016/tech-cc-hub/releases
```

The Release should contain:

- Windows installer `.exe`
- Windows updater metadata `latest.yml`
- macOS `.dmg`
- macOS `.zip`
- macOS updater metadata such as `latest-mac.yml`
- blockmap files

If update metadata is missing, the app may install manually but `electron-updater` will not discover it.

## Verification checklist

Before saying the update pipeline is ready, confirm:

- `electron-builder.json` has `publish.provider = github`.
- `electron-builder.json` points to `lst016/tech-cc-hub`.
- macOS target includes both `dmg` and `zip`.
- Windows target is `nsis`.
- `.github/workflows/release.yml` has `contents: write`.
- Workflow uses `GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}`.
- The current repo is public, or private Actions minutes are acceptable.

## Recovery

If a release is bad:

- Do not mutate the old tag unless the user explicitly asks.
- Fix forward with a higher version.
- Add release notes explaining the broken version.
- Keep updater metadata monotonic so clients see the next valid version.

