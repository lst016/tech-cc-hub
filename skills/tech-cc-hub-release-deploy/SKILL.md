---
name: tech-cc-hub-release-deploy
description: Use when committing, pushing, packaging, or publishing tech-cc-hub releases from this Windows repo, especially when Git push is flaky, a version tag must be moved, or GitHub Release notes/assets must be updated.
---

# tech-cc-hub Release Deploy

Use this skill from `D:\tool\tech-cc-hub` when the user asks to commit, push, deploy, tag, release, retag, or "打个 release".

## Default Flow

1. Inspect scope first:
   - `git status --short --branch`
   - `git diff --stat`
   - `git log --oneline --decorate --max-count=8`
2. Decide whether the user wants a narrow release or all dirty files. If they say "都要提交", use `git add -A`.
3. Verify before committing:
   - For UI/electron changes, run targeted `npx eslint ...`.
   - For release builds, run `npm run package:win`; it includes `transpile:electron` and `build`.
4. Commit with the repo Lore trailer style from `AGENTS.md`.
5. Publish with the script in this skill when normal `git push` fails or when a tag needs to be moved:
   - `node skills/tech-cc-hub-release-deploy/scripts/publish-release.mjs --tag vX.Y.Z --retag --delete-release`
6. Poll the `Release` workflow, not the older `Build and Release` workflow:
   - `https://api.github.com/repos/lst016/tech-cc-hub/actions/runs?per_page=10&event=push`
7. Confirm the GitHub Release has `latest.yml` and the Windows installer asset.
8. Update Release notes with `--notes-only` if the body is empty or stale.

## Commands

Publish current `HEAD` and move a release tag:

```powershell
node skills/tech-cc-hub-release-deploy/scripts/publish-release.mjs --tag v0.1.13 --retag --delete-release
```

Update only release notes:

```powershell
node skills/tech-cc-hub-release-deploy/scripts/publish-release.mjs --tag v0.1.13 --notes .tmp/release-notes-v0.1.13.md --notes-only
```

Use `--api-only` when `git push` is known to fail with:

```text
fatal: not a git repository (or any of the parent directories): .git
```

## Script Behavior

`scripts/publish-release.mjs` first tries normal `git push` unless `--api-only` is passed. If push fails, it uses the GitHub Git Data API with the machine's saved GitHub credential:

- reads token from `GH_TOKEN`, `GITHUB_TOKEN`, or `git credential fill`
- mirrors the diff from remote `main` to local `HEAD` into a new remote commit
- updates `refs/heads/main`
- creates a new annotated tag object when `--tag` is provided
- force-updates the tag only when `--retag` is provided
- deletes the existing GitHub Release first only when `--delete-release` is provided
- patches the GitHub Release body when `--notes` is provided

The API fallback may create a different commit SHA than local `HEAD`, but the tree must match. After an API fallback, run:

```powershell
git fetch origin main
git rev-parse "HEAD^{tree}"
git rev-parse "origin/main^{tree}"
```

If the tree SHAs match, align local `main` without touching files:

```powershell
git reset --soft origin/main
```

## Release Notes Shape

Keep notes short and concrete:

```markdown
## Updates
- Browser: ...
- Settings: ...
- Updater: ...

## Verification
- npm run package:win
- GitHub Release workflow: success
```
