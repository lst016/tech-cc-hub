# src/ui/utils/code-reference-prompt.ts

> 模块：`ui-shell` · 语言：`typescript` · 行数：106

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `isRecord@18`
- `getRecordString@22`
- `getRecordNumber@27`
- `parseJsonPayload@32`
- `getFileNameFromPath@45`
- `summarizeItem@50`
- `extractCodeReferencesPrompt@75`
- `value@24`
- `value@29`
- `start@34`
- `end@35`
- `parsed@39`
- `file@55`
- `range@57`
- `selection@58`
- `filePath@59`
- `type@60`
- `blocks@80`
- `codeReferences@84`
- `payload@86`
- `count@93`
- `CodeReferencePromptSummary@1`
- `CodeReferencesPayload@13`

## 对外暴露

- `CodeReferencePromptSummary`
- `extractCodeReferencesPrompt`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
export type CodeReferencePromptSummary = {
  index: number;
  kind: 'comment' | 'selection';
  filePath?: string;
  fileName?: string;
  language?: string;
  rangeLabel?: string;
  startLine?: number;
  endLine?: number;
  comment?: string;
  selectionPreview?: string;
};

type CodeReferencesPayload = {
  count?: number;
  items?: unknown[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getRecordString(record: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = record?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function getRecordNumber(record: Record<string, unknown> | undefined, key: string): number | undefined {
  const value = record?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function parseJsonPayload(blockContent: string): CodeReferencesPayload | null {
  const start = blockContent.indexOf('{');
  const end = blockContent.lastIndexOf('}');
  if (start < 0 || end <= start) return null;

  try {
    const parsed = JSON.parse(blockContent.slice(start, end + 1));
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function getFileNameFromPath(path?: string): string | undefined {
  if (!path) return undefined;
  return path.split(/[\\/]/).filter(Boolean).pop() || path;
}

function summarizeItem(item: unknown, index: number): CodeReferencePromptSummary {
  if (!isRecord(item)) {
    return { index: index + 1, kind: 'selection' };
  }

  const file = isRecord(item.file) ? item.file : undefined;
  const range = isRecord(item.range) ? item.range : undefined;
  const selection = isRecord(item.selection) ? item.selection : undefined;
  const filePath = getRecordString(file, 'path');
  const type = getRecordString(item, 'type');

  return {
    index: getRecordNumber(item, 'index') ?? index + 1,
    kind: type === 'code_comment' ? 'comment' : 'selection',
    filePath,
    fileName: getRecordString(file, 'name') ?? getFileNameFromPath(filePath),
    language: getRecordString(file, 'language'),
    rangeLabel: getRecordString(range, 'label'),
    startLine: getRecordNumber(range, 'startLine'),
    endLine: getRecordNumber(range, 'endLine'),
    comment: getRecordString(item, 'comment'),
    selectionPreview: getRecordString(selection, 'text'),
  };
}

export function extractCodeReferencesPrompt(prompt: string): {
  visiblePrompt: string;
  codeReferences: CodeReferencePromptSummary[];
} {
  const blocks = Array.from(prompt.matchAll(/<code_references>\s*([\s\S]*?)\s*<\/code_references>/g));
  if (blocks.length === 0) {
    return { visiblePrompt: prompt, codeReferences: [] };
  }

  const codeReferences = blocks.reduce<CodeReferencePromptSummary[]>((items, block) => {
    const payload = parseJsonPayload(block[1]);
    if (payload && Array.isArray(payload.items)) {
      payload.items.forEach((item) => {
        items.push(summarizeItem(item, items.length));
      });
      return items;
    }

    const count = payload && typeof payload.count === 'number' ? payload.count : 1;
    for (let index = 0; index < count; index += 1) {
      items.push({ index: items.length + 1, kind: 'selection' });
    }
    return items;
  }, []);

  return {
    visiblePrompt: prompt.replace(/<code_references>[\s\S]*?<\/code_references>/g, '').trim(),
    codeReferences,
  };
}

```
