# tech-cc-hub Knowledge Engine 实施 Spec

> 设计背景与选型理由见 `knowledge-engine-development-plan.md`。本文件只保留执行口径、接口契约和验收标准。

## 结论

当前方案可以进入实施。边界已经收敛：

- 项目内只生成 `.tech/`，不读取、不导入、不兼容 `.qoder`。
- `.tech/` 只放 Markdown / JSON 可读产物，不放 `.db` / `.sqlite`。
- Qdrant 当前版本不考虑。
- Knowledge Engine 必须依赖可用向量模型；没有 embedding 不允许开启。
- 模型设置新增两个槽位：
  - **向量模型**：默认云端 OpenAI-compatible，用于 embedding。
  - **Wiki 生成模型**：便宜/免费文本模型，用于批量生成 `.tech/repowiki`。
- app data 内部使用 SQLite / FTS5 / sqlite-vec 做索引和向量检索。

## 目标

把 Knowledge Engine 做成 tech-cc-hub 的内置版本功能，而不是外部插件说明书。交付后，用户在 Settings 里配置向量模型和 Wiki 生成模型，即可生成 `.tech/` 知识产物，并让 Agent 通过内置 MCP 搜索、读取和沉淀知识。

## 目录与存储约定

项目目录：

```text
.tech/
  repowiki/
    zh/
      content/
      meta/
        repowiki-metadata.json
  memory/
    memories.json
  reports/
    index-state.json
    skipped-files.json
    generation-report.json
```

app data 内部缓存：

```text
<appData>/knowledge/<workspaceHash>/knowledge.sqlite
<appData>/knowledge/<workspaceHash>/memory.sqlite
```

跨平台路径策略：

- Electron 主进程统一使用 `app.getPath("userData")` 作为 `<appData>` 根路径，不在 renderer 侧拼接系统目录。
- macOS 预期路径：`~/Library/Application Support/tech-cc-hub/knowledge/<workspaceHash>/...`。
- Windows 预期路径：`%APPDATA%/tech-cc-hub/knowledge/<workspaceHash>/...`。
- dev / preview 环境可以通过 app name 或显式 userData override 隔离测试数据，但不能写入 workspace 下的 `.tech` 之外位置。

规则：

- `.tech` 是用户可读协议产物，只允许 Markdown / JSON / 报告。
- SQLite、FTS5、sqlite-vec、chunk cache、embedding cache 全部放 app data。
- `<workspaceHash>` 使用 workspace 绝对路径稳定 hash，避免同名目录冲突。

## 实施阶段

### Phase 1：模型槽位与配置

修改：

```text
src/electron/libs/config-store.ts
src/ui/types.ts
src/ui/components/settings/model-routing-utils.ts
src/ui/components/settings/ModelRoutingSettingsPage.tsx
src/shared/model-provider-routing.ts
```

新增到 `ApiConfig` / `ApiConfigProfile`：

```ts
embeddingModel?: string;
embeddingDimension?: number;
embeddingBatchSize?: number;
wikiModel?: string;
wikiModelCostTier?: "free" | "cheap" | "standard";
wikiModelMaxInputTokens?: number;
wikiModelMaxOutputTokens?: number;
```

UI 规则：

- `ModelRoutingSettingsPage` 增加两个 `ModelSelect`：
  - 向量模型
  - Wiki 生成模型
- 向量模型不允许为空，否则 Knowledge Engine 开关置灰。
- Wiki 生成模型允许为空，但为空时 Refresh/Rebuild Wiki 不可执行。
- 文案明确：Wiki 生成模型应选择便宜/免费模型，不占用主聊天模型。

验证：

```bash
npm run transpile:electron
npm run build
```

### Phase 2：Knowledge 类型、路径和 `.tech` writer

新增：

```text
src/electron/libs/knowledge/knowledge-types.ts
src/electron/libs/knowledge/knowledge-paths.ts
src/electron/libs/knowledge/tech-workspace.ts
src/electron/libs/knowledge/knowledge-ignore.ts
```

职责：

- 解析 workspace path。
- 创建 `.tech/repowiki/zh/content`、`.tech/repowiki/zh/meta`、`.tech/memory`、`.tech/reports`。
- 创建 app data 内部 `<workspaceHash>` 目录。
- 写入 `.tech/reports/index-state.json`、`skipped-files.json`、`generation-report.json`。
- 默认 ignore：
  - `.git`
  - `node_modules`
  - `dist`
  - `dist-electron`
  - `dist-test`
  - `coverage`
  - `.vite`
  - `build`
  - `.env*`
  - secret / token / credential 命名文件

验收：

- 新建空 `.tech` 目录后不出现 `.db` / `.sqlite`。
- skipped files 报告可读。

### Phase 3：内部索引库和 sqlite-vec

新增：

```text
src/electron/libs/knowledge/knowledge-db.ts
src/electron/libs/knowledge/knowledge-repository.ts
src/electron/libs/knowledge/sqlite-vec-vector-store.ts
src/electron/libs/knowledge/embedding-provider.ts
src/electron/libs/knowledge/embedding-openai-compatible.ts
```

数据库位置：

```text
<appData>/knowledge/<workspaceHash>/knowledge.sqlite
```

核心表：

- `knowledge_sources`
- `knowledge_chunks`
- `knowledge_chunks_fts`
- `knowledge_vectors`
- `knowledge_index_jobs`

向量模型 health check：

- 读模型槽位。
- 调 OpenAI-compatible `/v1/embeddings`。
- 校验返回向量维度。
- 记录模型名、维度、耗时、最近错误、`lastHealthCheckAt`。
- health check 结果缓存 5 分钟；用户手动测试、模型配置变更、baseURL/apiKeyRef 变更时强制刷新。
- 失败时 Knowledge Engine 不可开启，MCP 返回 `embedding_unavailable`，UI 展示错误原因和最近检查时间。

增量索引策略：

- 文件 hash 未变：跳过 chunk / FTS / embedding。
- 文件 hash 变化：只删除并重建该文件的 chunk、FTS、vector。
- 新增文件：只处理新增文件。
- 删除文件：`knowledge_sources.deleted_at` 标记 tombstone，并删除或失效关联 chunk/vector。
- 向量模型、维度或 provider 改变：只标记 `needs_reembed=1`，不删除 Markdown 源。
- 新增/删除文件数超过上次扫描文件数 10%，或入口文件 / package workspace 根变化：触发 catalog 重规划。

验收：

- `sqlite-vec` 能被 Electron 主进程加载。
- chunk 变更时按 hash 增量重建。
- 向量模型变更时标记需要 re-embed。
- FTS5 只作为辅助，不能替代 embedding 启用门槛。

### Phase 4：Repo Wiki 生成器适配

新增：

```text
src/electron/libs/knowledge/wiki-generation-model.ts
src/electron/libs/knowledge/repowiki-runner.ts
src/electron/libs/knowledge/repowiki-adapter.ts
src/electron/libs/knowledge/markdown-section-parser.ts
```

策略：

- 第一版用 RepoWiki fork/vendor 或受控 sidecar CLI。
- tech-cc-hub 负责调用、参数、输出目录、checkpoint、输出索引和错误报告。
- 输出目录固定 `.tech/repowiki/zh`。
- 生成器必须在 Phase 3 的索引库存在后接入，生成完成的页面直接进入 chunk -> FTS -> embedding -> store 链路。
- `repowiki-metadata.json` 至少包含：
  - `schemaVersion: "1.0"`
  - `repo`
  - `catalogs`
  - `items`
  - `dependent_files`
  - `progress_status`
  - `source_refs`
  - `generated_at`
  - `generator`
  - `checkpoint`
  - `token_budget`

Wiki 生成模型 health check：

- 读模型槽位。
- 用短输入生成一小段 Markdown。
- 记录耗时、错误、`lastHealthCheckAt`。
- health check 结果缓存 5 分钟；用户手动测试或模型配置变更时强制刷新。
- 失败时禁止 Refresh/Rebuild Wiki，UI 展示 `wiki_model_unavailable` 原因。

Token 预算：

- 小仓库 `<100` 文件：单次 Wiki 生成 output token 上限 `200K`。
- 中仓库 `100-500` 文件：单次 Wiki 生成 output token 上限 `500K`。
- 大仓库 `>500` 文件：单次 Wiki 生成 output token 上限 `1M`。
- 超预算时降低每篇深度、压缩示例和图表，不减少 catalog 覆盖面。

错误恢复：

- 每完成一个 catalog 节点或页面，写入 checkpoint。
- crash、断网、模型超时后，下一次 refresh 默认从最后 checkpoint 续做。
- 单页失败不终止全局生成；写入 `generation-report.json` 并在 metadata 中标记 failed item。
- Catalog 规划失败时使用 profile anchor fallback：项目总览、运行与配置、核心模块、数据/接口、扩展点、故障排查。

验收：

- 点击 Refresh/Rebuild Wiki 可以生成 `.tech/repowiki/zh/content/*.md`。
- 失败时 `.tech/reports/generation-report.json` 有错误信息。
- 中断后再次点击 Refresh 能从 checkpoint 继续，而不是全量重来。
- metadata 顶层含 `schemaVersion`，旧 schema 进入迁移/重建提示。

### Phase 5：Memory

新增：

```text
src/electron/libs/memory/memory-types.ts
src/electron/libs/memory/memory-repository.ts
src/electron/libs/memory/memory-overview.ts
```

内部库：

```text
<appData>/knowledge/<workspaceHash>/memory.sqlite
```

可读快照：

```text
.tech/memory/memories.json
```

规则：

- workspace 级 memory 写入 `memory.sqlite`。
- 每次变更后导出 `memories.json`。
- global memory 后续可放全局 app data，不进入当前 MVP。
- memory 可被 `knowledge_search` 检索，但必须标明 `sourceKind: "memory"`。

### Phase 6：内置 Knowledge MCP

新增：

```text
src/electron/libs/mcp-tools/knowledge.ts
```

修改：

```text
src/shared/builtin-mcp-registry.ts
src/electron/libs/builtin-mcp-servers.ts
```

新增 server：

```text
tech-cc-hub-knowledge
```

工具：

```ts
knowledge_search({
  query: string;
  mode?: "semantic" | "keyword" | "hybrid";
  sourceKinds?: Array<"repo_wiki" | "code" | "memory" | "decision">;
  limit?: number;
  explain?: boolean;
})

knowledge_read({
  id?: string;
  path?: string;
  title?: string;
  sourceKind?: "repo_wiki" | "code" | "memory" | "decision";
  maxChars?: number;
})

knowledge_explore({
  view?: "overview" | "repo_wiki_tree" | "memory_categories" | "index_status";
  maxItems?: number;
})

knowledge_index({
  action: "status" | "refresh" | "rebuild";
  targets?: Array<"repowiki" | "code" | "memory">;
})

knowledge_status({
  includeHealth?: boolean;
  includeCounts?: boolean;
  includeLastErrors?: boolean;
})

memory_update({
  action: "add" | "update" | "delete";
  title: string;
  content?: string;
  category?: string;
  tags?: string;
  scope?: "global" | "workspace";
  evidenceRefs?: string[];
})
```

MCP 行为：

- embedding 不可用：`knowledge_search` 返回 `embedding_unavailable`。
- Wiki 生成模型不可用：`knowledge_index refresh/rebuild` 返回 `wiki_model_unavailable`。
- `knowledge_read` 可读取 `.tech/repowiki` 页面或内部 chunk。
- `knowledge_status` 即使在 embedding 不可用时也必须可调用，用于告诉 Agent 当前索引文件数、chunk 数、最后更新时间、health check 原因、最近错误和下一步修复建议。

### Phase 7：Runner prompt 与 Prompt Ledger

新增：

```text
src/electron/libs/knowledge/knowledge-overview.ts
```

修改：

```text
src/electron/libs/runner.ts
src/electron/libs/system-prompt-presets.ts
src/shared/prompt-ledger.ts
src/shared/activity-rail-model.ts
src/ui/components/ActivityRail.tsx
src/ui/components/SessionAnalysisPage.tsx
```

注入位置：

```text
global runtime prompt
admin prompt
agent context prompt
Claude project memory
knowledge overview
tool optimization
browser/design prompt
builtin MCP registry
Claude compat prompt
```

overview 示例：

```xml
<knowledge_overview workspace="tech-cc-hub" status="ready">
  <repo_wiki pages="47" status="ready" />
  <index fts_chunks="1200" vector_chunks="1200" embedding_model="text-embedding-..." />
  <tools>knowledge_search, knowledge_read, knowledge_explore, knowledge_index, knowledge_status, memory_update</tools>
</knowledge_overview>
```

规则：

- overview 不放全文。
- 全文必须通过 `knowledge_read` 拉取。
- Prompt Ledger 记录 knowledge overview 和 tool result 来源。

### Phase 8：Settings 页面

新增：

```text
src/ui/components/settings/KnowledgeSettingsPage.tsx
```

修改：

```text
src/ui/components/SettingsModal.tsx
src/electron/ipc-handlers.ts
src/electron/main.ts
src/ui/types.ts
```

页面内容：

- Knowledge Engine 总开关。
- `.tech` 状态。
- 向量模型状态。
- Wiki 生成模型状态。
- sqlite-vec 状态。
- 索引状态。
- 最近一次 health check 时间 `lastHealthCheckAt`。
- 不可用原因：provider 未配置、baseURL 不可达、API key 失效、模型不存在、维度不匹配、sqlite-vec 加载失败。
- Refresh / Rebuild Wiki。
- Rebuild vectors。
- skipped files / generation report 链接。

开关规则：

- 向量模型 health check 未通过：Knowledge Engine 不能开启。
- Wiki 生成模型 health check 未通过：不能执行 Refresh/Rebuild Wiki。
- sqlite-vec 不可用：Knowledge Engine 不能开启。
- 任何置灰按钮都必须显示原因和最近检查时间，不能只禁用交互。

## 测试计划

新增测试：

```text
test/electron/knowledge-paths.test.ts
test/electron/knowledge-repowiki-adapter.test.ts
test/electron/knowledge-markdown-parser.test.ts
test/electron/knowledge-repository.test.ts
test/electron/knowledge-sqlite-vec.test.ts
test/electron/knowledge-model-health.test.ts
test/electron/knowledge-mcp-server.test.ts
test/electron/knowledge-status-tool.test.ts
test/electron/knowledge-incremental-index.test.ts
test/electron/knowledge-repowiki-checkpoint.test.ts
test/electron/knowledge-token-budget.test.ts
test/electron/memory-repository.test.ts
```

必跑命令：

```bash
npm run transpile:electron
npm run build
```

手工验收：

1. 设置向量模型，health check 通过。
2. 设置便宜/免费 Wiki 生成模型，health check 通过。
3. 点击 Refresh Wiki，生成 `.tech/repowiki/zh`。
4. 确认 `.tech` 内没有 `.db` / `.sqlite`。
5. 构建索引和 embedding。
6. 新会话提问“内置 MCP 怎么注册”。
7. Agent 使用 `knowledge_search`。
8. `knowledge_read` 能读回相关 Wiki 页面。
9. `memory_update` 写入决策后 `.tech/memory/memories.json` 更新。
10. Prompt Ledger 显示 knowledge source。
11. 修改一个源文件后只重建该文件对应 chunk/vector，不全量重建。
12. 中断 Wiki 生成后重新执行 refresh 能从 checkpoint 继续。
13. `knowledge_status` 能返回 health、counts、last errors 和修复建议。

## 风险

- RepoWiki fork/sidecar 与 Electron 打包边界复杂：先用受控 CLI spike，确认可打包再固化。
- sqlite-vec 在 Electron 下加载可能受 native/extension 限制：Phase 0 必须先 spike。
- 云端向量模型成本：必须支持 batch size、增量 hash、模型变更重建提示。
- Wiki 生成成本：必须默认低成本/免费模型，不走主聊天模型。
- `.tech` 作为可读协议目录，要保持稳定，避免把运行缓存混进去。
- 旧版 metadata schema 演进会导致 UI 读不到内容：`repowiki-metadata.json` 必须带 `schemaVersion`，并在 adapter 层做迁移或重建提示。
- 模型超时或断网会让长任务中断：生成器必须 checkpoint 化，不能要求用户每次全量重跑。

## 推荐开发分支

```text
codex/knowledge-engine-tech-spec
```
