---
name: tech-cc-hub-release-deploy
description: 用于在 tech-cc-hub Windows 仓库里提交、推送、打包、发布、移动版本 tag、补 GitHub Release 更新内容，尤其适合 git push 抽风或需要重发 release 的场景。
---

# tech-cc-hub 发布部署

在 `D:\tool\tech-cc-hub` 里，用户要求提交、推送、部署、打 tag、打 release、移动 tag、补发布说明时使用本 skill。

## 默认流程

1. 先确认范围：
   - `git status --short --branch`
   - `git diff --stat`
   - `git log --oneline --decorate --max-count=8`
2. 判断用户要窄范围提交还是全量提交。用户说“都要提交”时，用 `git add -A`。
3. 提交前先验证：
   - UI / Electron 改动跑定向 `npx eslint ...`。
   - 发布构建跑 `npm run package:win`；它会包含 `transpile:electron` 和 `build`。
4. commit message 按 `AGENTS.md` 的 Lore trailer 风格写。
5. 普通 `git push` 失败或需要移动 tag 时，用本 skill 的脚本发布：
   - `node skills/tech-cc-hub-release-deploy/scripts/publish-release.mjs --tag vX.Y.Z --retag --delete-release`
6. 轮询新的 `Release` workflow，不要以旧的 `Build and Release` workflow 为准：
   - `https://api.github.com/repos/lst016/tech-cc-hub/actions/runs?per_page=10&event=push`
7. 确认 GitHub Release 里有 `latest.yml` 和 Windows 安装包。
8. 如果发布说明为空或过旧，用 `--notes-only` 补更新内容。

## 常用命令

发布当前 `HEAD` 并移动 release tag：

```powershell
node skills/tech-cc-hub-release-deploy/scripts/publish-release.mjs --tag v0.1.13 --retag --delete-release
```

只更新发布说明：

```powershell
node skills/tech-cc-hub-release-deploy/scripts/publish-release.mjs --tag v0.1.13 --notes .tmp/release-notes-v0.1.13.md --notes-only
```

已知 `git push` 会出现下面错误时，加 `--api-only`：

```text
fatal: not a git repository (or any of the parent directories): .git
```

## 脚本行为

除非传入 `--api-only`，`scripts/publish-release.mjs` 会先尝试普通 `git push`。如果 push 失败，就使用当前机器保存的 GitHub credential 调 GitHub Git Data API：

- 从 `GH_TOKEN`、`GITHUB_TOKEN` 或 `git credential fill` 读取 token。
- 把远端 `main` 到本地 `HEAD` 的差异重建成一个远端 commit。
- 更新 `refs/heads/main`。
- 传入 `--tag` 时创建 annotated tag object。
- 只有传入 `--retag` 时才强制移动 tag。
- 只有传入 `--delete-release` 时才先删除已有 GitHub Release。
- 传入 `--notes` 时更新 GitHub Release body。

API fallback 生成的远端 commit SHA 可能和本地 `HEAD` 不同，但 tree 必须一致。API fallback 后运行：

```powershell
git fetch origin main
git rev-parse "HEAD^{tree}"
git rev-parse "origin/main^{tree}"
```

如果 tree SHA 一致，用下面命令对齐本地 `main`，不会改工作区文件：

```powershell
git reset --soft origin/main
```

## 发布说明格式

发布说明默认写中文。需要照顾外部用户时，用“中文在前，英文可选”的中英双语；不要只写英文。

保持简短、具体：

```markdown
## 更新内容
- 浏览器工作台：...
- 设置页：...
- 更新器：...

## 验证
- `npm run package:win`
- GitHub `Release` workflow：成功

## English Notes (optional)
- Browser workbench: ...
```
