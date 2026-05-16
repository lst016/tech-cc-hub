# src/ui/utils/preview-file-refresh.ts

> 模块：`ui-shell` · 语言：`typescript` · 行数：83

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `isRecord@20`
- `getMessageContent@24`
- `getWriteToolPath@32`
- `normalizePreviewFilePath@41`
- `collectCompletedPreviewFileChanges@46`
- `WRITE_TOOL_NAMES@1`
- `rawMessage@27`
- `content@29`
- `filePath@37`
- `normalized@43`
- `pendingWriteToolPaths@48`
- `seenOperationIds@50`
- `contents@54`
- `path@59`
- `result@69`
- `path@73`
- `PreviewFileChangeEvent@2`
- `ToolUseContent@7`
- `ToolResultContent@14`

## 对外暴露

- `PreviewFileChangeEvent`
- `normalizePreviewFilePath`
- `collectCompletedPreviewFileChanges`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
const WRITE_TOOL_NAMES = new Set(['write', 'edit', 'multiedit']);

export type PreviewFileChangeEvent = {
  path: string;
  operationId: string;
};

type ToolUseContent = {
  type?: unknown;
  id?: unknown;
  name?: unknown;
  input?: unknown;
};

type ToolResultContent = {
  type?: unknown;
  tool_use_id?: unknown;
  is_error?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getMessageContent(message: unknown): unknown[] {
  if (!isRecord(message)) return [];
  const rawMessage = message.message;
  if (!isRecord(rawMessage)) return [];
  const content = rawMessage.content;
  return Array.isArray(content) ? content : [content];
}

function getWriteToolPath(content: ToolUseContent): string | null {
  if (content.type !== 'tool_use') return null;
  if (typeof content.name !== 'string' || !WRITE_TOOL_NAMES.has(content.name.toLowerCase())) return null;
  if (!isRecord(content.input)) return null;

  const filePath = content.input.file_path;
  return typeof filePath === 'string' && filePath.trim() ? filePath.trim() : null;
}

export function normalizePreviewFilePath(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  return /^[a-z]:\//i.test(normalized) ? normalized.toLowerCase() : normalized;
}

export function collectCompletedPreviewFileChanges(messages: readonly unknown[]): PreviewFileChangeEvent[] {
  const pendingWriteToolPaths = new Map<string, string>();
  const changes: PreviewFileChangeEvent[] = [];
  const seenOperationIds = new Set<string>();

  for (const message of messages) {
    if (!isRecord(message) || typeof message.type !== 'string') continue;
    const contents = getMessageContent(message);

    if (message.type === 'assistant') {
      for (const content of contents) {
        if (!isRecord(content)) continue;
        const path = getWriteToolPath(content);
        if (!path || typeof content.id !== 'string') continue;
        pendingWriteToolPaths.set(content.id, path);
      }
      continue;
    }

    if (message.type !== 'user') continue;
    for (const content of contents) {
      if (!isRecord(content)) continue;
      const result = content as ToolResultContent;
      if (result.type !== 'tool_result' || typeof result.tool_use_id !== 'string') continue;
      if (result.is_error) continue;
      if (seenOperationIds.has(result.tool_use_id)) continue;

      const path = pendingWriteToolPaths.get(result.tool_use_id);
      if (!path) continue;
      changes.push({ path, operationId: result.tool_use_id });
      seenOperationIds.add(result.tool_use_id);
    }
  }

  return changes;
}

```
