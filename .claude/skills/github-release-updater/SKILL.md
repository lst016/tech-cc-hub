---
name: github-release-updater
description: Publish tech-cc-hub desktop app updates through package version bumps, annotated tags, GitHub Releases, GitHub Actions, and electron-updater metadata. Use when the user asks to bump/release a version, publish a tag, update GitHub Release notes, trigger auto-update metadata, or package macOS/Windows desktop builds without deploying a server.
---

# GitHub Release Updater

## Purpose

Use this skill to release `tech-cc-hub` desktop updates through GitHub only:

- no custom update server
- GitHub Actions builds installers
- GitHub Releases hosts installers and update metadata
- `electron-updater` checks GitHub Releases from the desktop client

## Non-negotiable rules

- Do not guess the version. Read `package.json`, local tags, and remote tags first.
- Do not tag before the release commit is final. The tag must point at the commit being released.
- Do not bump the version twice. If `package.json` is already at the target version, skip `npm version`.
- Do not manually edit or reuse an existing release tag unless the user explicitly asks to retag.
- Do not rely on raw `git push` in this Windows repo after it reports `.git` discovery errors.
- Do not publish Windows production builds from macOS by default; use GitHub Actions `windows-latest`.
- Do not use the Windows `portable` target as the auto-update path; use `nsis`.
- Keep macOS `zip` target enabled because updater metadata depends on it.
- If QA was not run in the current turn, say that plainly before release.

## Correct Version Update Flow

Start every version task with these reads:

```powershell
git status --short --branch
git log --oneline --decorate --max-count=8
git tag --sort=-creatordate | Select-Object -First 10
git ls-remote origin refs/heads/main refs/tags/vX.Y.Z "refs/tags/vX.Y.Z^{}"
Get-Content package.json | Select-String '"version"'
```

Then choose exactly one path.

### Path A: package version needs to change

Use this when `package.json` is not yet the target version.

```powershell
npm version X.Y.Z --no-git-tag-version
git add package.json package-lock.json
git commit -m "<Lore protocol release intent>"
git tag -a vX.Y.Z -m "Release vX.Y.Z"
node skills/tech-cc-hub-release-deploy/scripts/publish-release.mjs --tag vX.Y.Z --api-only
```

Use `package-lock.json` only when it exists and changed. The `npm version ... --no-git-tag-version` command is the correct way to keep `package.json` and `package-lock.json` aligned.

### Path B: package version is already correct, tag is missing

Use this when `package.json` already says `X.Y.Z` but `vX.Y.Z` was not created or pushed.

```powershell
git status --short --branch
git add -u
git commit -m "<Lore protocol release/fix intent>"
git tag -a vX.Y.Z -m "Release vX.Y.Z"
node skills/tech-cc-hub-release-deploy/scripts/publish-release.mjs --tag vX.Y.Z --api-only
```

If there are no code/doc changes to commit, create the annotated tag on the already verified release commit and publish it:

```powershell
git tag -a vX.Y.Z -m "Release vX.Y.Z"
node skills/tech-cc-hub-release-deploy/scripts/publish-release.mjs --tag vX.Y.Z --api-only
```

Do not run `npm run release:github -- patch` in this case; it will compute the next patch and can create the wrong version.

### Path C: GitHub Release notes need to be repaired

Use this when the branch and tag are already correct but the GitHub Release body is missing, stale, or garbled.

```powershell
node skills/tech-cc-hub-release-deploy/scripts/publish-release.mjs --tag vX.Y.Z --notes .tmp/release-notes-vX.Y.Z.md --notes-only
```

Keep release notes short, concrete, and Chinese-first unless the user asks for another language.

## About `npm run release:github`

`npm run release:github -- patch|minor|major|vX.Y.Z` calls `scripts/github-release.mjs`.

That script is useful only for a clean, normal environment where raw `git push` works. It:

1. Requires a clean worktree unless `--allow-dirty` is passed.
2. Computes the next version.
3. Runs `npm version <version> --no-git-tag-version`.
4. Commits `package.json` and `package-lock.json`.
5. Creates annotated tag `vX.Y.Z`.
6. Runs raw `git push` for branch and tag.
7. Uses the GitHub API to create or update the GitHub Release body.

In this Windows repo, raw `git push` has repeatedly failed with:

```text
fatal: not a git repository (or any of the parent directories): .git
```

When that happens, stop retrying raw `git push`. Use:

```powershell
node skills/tech-cc-hub-release-deploy/scripts/publish-release.mjs --tag vX.Y.Z --api-only
```

The deploy script reads `GH_TOKEN`, `GITHUB_TOKEN`, or Git Credential Manager via `git credential fill`, uploads the local commit graph through GitHub Git Data API, verifies tree/commit SHA parity, updates `origin/main`, creates the annotated tag ref, and syncs local `origin/main`.

## Verification After Publish

After publishing, verify all refs point at the release commit:

```powershell
git rev-parse HEAD
git rev-parse origin/main
git rev-parse "vX.Y.Z^{}"
git ls-remote origin refs/heads/main refs/tags/vX.Y.Z "refs/tags/vX.Y.Z^{}"
```

Expected:

- local `HEAD` equals local `origin/main`
- remote `refs/heads/main` equals local `HEAD`
- local and remote `vX.Y.Z^{}` equal local `HEAD`
- `git status --short --branch` no longer shows `ahead`

If any SHA differs, stop and fix refs before claiming the release is published.

## Expected Release Assets

After the tag push triggers `.github/workflows/release.yml`, check:

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

## Recovery

If a release is bad:

- Do not mutate the old tag unless the user explicitly asks.
- Fix forward with a higher version.
- Add release notes explaining the broken version.
- Keep updater metadata monotonic so clients see the next valid version.
