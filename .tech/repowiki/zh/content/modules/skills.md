# skills

> 提供可复用的技能模块，支持自动化发布部署工作流，包括 Git 操作、GitHub API 调用和 Release 管理。

skills 模块是 Electron 工作台的技能库，每个技能（如 tech-cc-hub-release-deploy）包含脚本、文档和接口定义，支持提交、推送、打 tag、发布 GitHub Release 等自动化流程。脚本优先使用原生 git push，失败时 fallback 到 GitHub Git Data API。

## 文件

### `tech-cc-hub-release-deploy/SKILL.md`

技能使用说明文档，定义何时使用该技能、默认流程、常用命令和脚本行为。

- `DEFAULT_WORKFLOW` (constant) - 定义发布部署的默认步骤：确认范围→判断提交范围→验证代码→提交→推送→轮询 workflow→确认 Release
- `API_ONLY_FLAG` (flag) - 跳过 git push，直接使用 GitHub API 推送
- `RETAG_FLAG` (flag) - 移动已存在的 tag 到新 commit

### `tech-cc-hub-release-deploy/scripts/publish-release.mjs`

核心发布脚本，处理 git 操作和 GitHub API 交互，支持普通 push 和 API fallback。

- `main` (function) - 入口函数，解析参数并根据 flags 调用对应逻辑（普通 push 或 API 推送）
- `git` (function) - 同步执行 git 命令并返回字符串输出，用于获取 commit 信息和 status
- `gitBuffer` (function) - 执行 git 并返回 buffer，用于读取 blob 内容
- `runGit` (function) - spawnSync 执行 git，返回 ok/status/stdout/stderr，用于检测 push 是否失败
- `getCredentialToken` (function) - 从 GH_TOKEN、GITHUB_TOKEN 环境变量或 git credential fill 获取 GitHub token
- `request` (function) - 封装 HTTPS 请求到 GitHub API，处理 200-299 为 resolve，404 返回 __notFound，其余 reject
- `parseNameStatus` (function) - 解析 git diff --name-status --raw 的 null 分隔输出，处理 R/C 重命名/复制拆分为 D/A
- `createApiTreeForCommit` (function) - 对单个 commit 创建 GitHub blob/tree，校验 tree SHA 与本地一致
- `publishViaApi` (function) - 批量推送本地 commits 到 GitHub refs/heads/main，支持创建 annotated tag 和更新 release
- `syncOriginMain` (function) - API push 成功后同步本地 origin/main ref，避免显示 ahead
- `updateReleaseNotes` (function) - 调用 GitHub API 更新 Release body
- `OWNER` (constant) - GitHub 仓库所有者：lst016
- `REPO` (constant) - 仓库名：tech-cc-hub

### `tech-cc-hub-release-deploy/agents/openai.yaml`

技能的 LLM 接口定义，声明 display_name 和 short_description。

- `interface.display_name` (field) - 显示名称：tech-cc-hub 发布部署
- `interface.short_description` (field) - 简短描述：提交、推送、移动 tag、打包并更新 tech-cc-hub 的 GitHub Release

## 关键概念

- **API Fallback**: 当 git push 失败时（如 .git 目录问题），脚本自动 fallback 到 GitHub Git Data API 逐 commit 创建 blob/tree/commit 并更新 refs。
- **Tree SHA 校验**: API push 时校验 GitHub 创建的 tree SHA 必须与本地 commit tree SHA 完全一致，确保提交完整性。
- **Credential 优先级**: Token 获取顺序：GH_TOKEN > GITHUB_TOKEN > git credential fill，后者通过 git credential fill 向 Git Credential Manager 请求。
- **Tagged Release**: --tag 创建 annotated tag object；--retag 强制移动已存在 tag；--delete-release 先删除旧 Release 再创建新的。

## 内部关系

- `SKILL.md` → `scripts/publish-release.mjs`: SKILL.md 描述何时调用脚本及其参数含义
- `agents/openai.yaml` → `SKILL.md`: 接口定义引用 SKILL.md 作为技能说明
