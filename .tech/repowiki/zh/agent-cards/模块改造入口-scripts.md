# 模块改造入口：scripts

<agent_card id="module-scripts" kind="module">

## 什么时候用
当任务落在 scripts 时，优先读取这些高价值文件来确定入口、状态边界、接口契约和验证路径。

## 修改入口
- `scripts/codex-oauth-setup.mjs`: 入口文件，适合从这里跟踪启动链路
- `scripts/sync-claude-code-compat.mjs`: 入口文件，适合从这里跟踪启动链路
- `scripts/github-release.mjs`: 入口文件，适合从这里跟踪启动链路
- `scripts/package-win-safe.mjs`: 入口文件，适合从这里跟踪启动链路
- `scripts/dev-electron.mjs`: 入口文件，适合从这里跟踪启动链路

## 相关文件
- `scripts/codex-oauth-setup.mjs`
- `scripts/sync-claude-code-compat.mjs`
- `scripts/github-release.mjs`
- `scripts/package-win-safe.mjs`
- `scripts/dev-electron.mjs`

## 改代码指南
- 先确认需求是否真的属于 scripts，再从 entryFiles 里包含入口/IPC/schema/store 的文件开始。
- 修改共享契约时同步检查调用方、测试、QA smoke 和 system prompt/overview 影响。
- 如果文件带有 database、ipc、mcp_tool 或 store 信号，优先做真实运行验证。

## 验证方式
- npm run build

## 风险点
- Electron 主进程、renderer bridge 和浏览器预览数据源可能不一致。

## 检索关键词
scripts, codex-oauth-setup.mjs, entrypoint:scripts/codex-oauth-setup.mjs, event:codex, sync-claude-code-compat.mjs, entrypoint:scripts/sync-claude-code-compat.mjs, github-release.mjs, entrypoint:scripts/github-release.mjs, package-win-safe.mjs, entrypoint:scripts/package-win-safe.mjs, dev-electron.mjs, entrypoint:scripts/dev-electron.mjs

## 代码信号
- entrypoint:scripts/codex-oauth-setup.mjs
- event:codex
- entrypoint:scripts/sync-claude-code-compat.mjs
- entrypoint:scripts/github-release.mjs
- entrypoint:scripts/package-win-safe.mjs
- entrypoint:scripts/dev-electron.mjs

</agent_card>
