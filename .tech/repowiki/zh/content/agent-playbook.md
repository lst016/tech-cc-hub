# Agent 作业手册

## 为什么知识库功能必须有 embedding 模型

知识库不是普通全文搜索。Repo Wiki Markdown 会被切 chunk、写入 FTS5，并同时写入向量索引；没有 embedding 模型时，Agent 无法可靠做语义召回，所以功能必须保持关闭。

## Agent 如何在聊天里看到知识库

新会话构建 system prompt 时会注入 `<knowledge_overview>`，其中包含 Repo Wiki 标题、路径和记忆摘要。Agent 先看 overview，再通过 MCP 工具读取全文。

## 高价值文件

- `README.md`
- `doc/README.md`
- `doc/adr/README.md`
- `package.json`
- `package/README.md`
- `package/package.json`
- `pro-workflow/README.md`
- `pro-workflow/config.json`
- `pro-workflow/package.json`
- `pro-workflow/tsconfig.json`
- `src/electron/libs/git/README.md`
- `src/electron/libs/mcp-tools/README.md`
- `src/electron/libs/task/README.md`
- `src/electron/tsconfig.json`
- `test/electron/tsconfig.json`
- `tsconfig.json`
- `vite.config.ts`
- `pro-workflow/scripts/commit-validate.js`
- `src/electron/main.ts`：ipcMain.handle: preview-list-directory, ipcMain.handle: preview-list-files, ipcMain.handle: sessions:list
- `src/ui/App.tsx`：electron.invoke: sessions:list, electron.invoke: shell:openExternal
- `.mcp.json`
- `doc/20-contracts/ipc/spec.md`
- `doc/40-engineering/electron-ipc/spec.md`
- `doc/40-product/1.0.0/10-requirements/17-竞品功能拆解/09-MCP服务.md`
- `doc/40-product/1.0.0/40-delivery/components/CMP-005-LiveTimelinePanel.md`
- `doc/40-product/1.0.0/40-delivery/components/CMP-006-ArtifactJumpPanel.md`
- `doc/40-product/1.0.0/40-delivery/components/CMP-012-TaskResultPanel.md`
- `docs/superpowers/plans/2026-05-10-figma-official-mcp-plugin.md`
- `docs/superpowers/specs/2026-05-10-figma-official-mcp-plugin-design.md`
- `pro-workflow/commands/mcp-audit.md`
- `pro-workflow/mcp-config.example.json`
- `pro-workflow/skills/mcp-audit/SKILL.md`
- `pro-workflow/src/db/store.ts`
- `scripts/knowledge/run-repowiki.py`
- `scripts/qa/knowledge-chat-injection-smoke.mjs`
- `scripts/qa/knowledge-engine-smoke.mjs`
- `scripts/qa/knowledge-ui-smoke.cjs`
- `src/common/adapter/ipcBridge.ts`
- `src/electron/ipc-handlers.ts`
- `src/electron/libs/attachment-store.ts`
- `src/electron/libs/builtin-mcp-servers.ts`

## 验证命令

- `npm run qa:knowledge`
- `npm run qa:knowledge-ui`
- `npm run qa:knowledge-chat`
- `npm run build`

## 改动风险

- Repo Wiki 生成和索引是两条链路：Markdown 写入 `.tech/repowiki`，SQLite/向量索引写入 app data。
- UI 生成进度必须以后端 DB 和磁盘结果为准，刷新页面不能靠前端假进度恢复。
- 会话归档或 Git commit 变化触发自动更新时，要绑定 commitId，避免过期知识误导 Agent。
