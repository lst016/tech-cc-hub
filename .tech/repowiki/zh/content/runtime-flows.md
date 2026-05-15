# 关键运行链路

## 知识库生成、索引与注入

RepoWiki-compatible 生成器产出 Markdown，text splitter 切块，embedding 写入 sqlite-vec/FTS5，runner 再把 overview 注入 system prompt。

### 步骤

1. KnowledgePanel 通过 knowledge:run-generation 触发
2. knowledge-ui-store 调用 indexKnowledgeWorkspace
3. knowledge-indexer 调用 generateRepoWiki 并收集 Markdown
4. RecursiveCharacterTextSplitter 切 chunk，embedTextBatches 生成向量
5. KnowledgeRepository 写入 documents/chunks/FTS/vector
6. knowledge-overview 为新会话拼装 <knowledge_overview>

### 证据文件

- `src/ui/components/KnowledgePanel.tsx`
- `src/electron/libs/knowledge/knowledge-ui-store.ts`
- `src/electron/libs/knowledge/knowledge-indexer.ts`
- `src/electron/libs/knowledge/knowledge-repository.ts`
- `src/electron/libs/knowledge/knowledge-overview.ts`
- `src/electron/libs/runner.ts`

## 聊天会话执行

Renderer 发起 session.start，Electron 持久化会话并构造 runner，上下文、规则、MCP server 和知识库 overview 在 runner 层合并。

### 步骤

1. UI 创建会话请求
2. ipc-handlers/session-store 管理会话状态
3. runner 拼接 system prompt、Agent runtime、MCP 工具和工作区
4. stream 事件回写到 UI store

### 证据文件

- `src/electron/ipc-handlers.ts`
- `src/electron/libs/session-store.ts`
- `src/electron/libs/runner.ts`
- `src/ui/store/useAppStore.ts`

## 任务同步与执行

外部任务 provider 只负责映射任务，TaskExecutor 负责并发、恢复、重试、写回和执行记录。

### 步骤

1. provider-registry 注册外部任务源
2. TaskRepository 持久化任务、执行和日志
3. TaskExecutor 按状态调度并创建独立 workspace
4. 执行完成后更新任务状态并可写回外部系统

### 证据文件

- `src/electron/libs/task/provider-registry.ts`
- `src/electron/libs/task/repository.ts`
- `src/electron/libs/task/executor.ts`
- `src/electron/libs/task/workspace.ts`

## 内置 MCP 工具面

共享 registry 描述可见工具，Electron 工厂创建真实 MCP server；Agent 能调用 browser/design/git/knowledge/plan 等能力。

### 步骤

1. shared registry 提供 server 和 tool 元数据
2. builtin-mcp-servers 映射 server name 到工厂函数
3. runner 根据 runtime config 加载 MCP server
4. 工具处理器访问 BrowserView、Git、设计分析或知识库服务

### 证据文件

- `src/shared/builtin-mcp-registry.ts`
- `src/electron/libs/builtin-mcp-servers.ts`
- `src/electron/libs/mcp-tools/browser.ts`
- `src/electron/libs/mcp-tools/design.ts`
- `src/electron/libs/mcp-tools/plan.ts`
