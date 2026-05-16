# src/shared/preview-quick-open.ts

> 模块：`shared` · 语言：`typescript` · 行数：70

## 文件职责

对文件路径候选进行评分和过滤，用于快速打开面板的模糊匹配

## 关键符号

- `PreviewQuickOpenEntry@0 - 快速打开条目：name、path、relativePath、size`
- `scorePreviewQuickOpenEntry@0 - 对单个条目评分，考虑路径和名称中的 token 匹配度`
- `filterPreviewQuickOpenEntries@0 - 过滤并返回排序后的条目列表，限制数量为 limit`

## 对外暴露

- `PreviewQuickOpenEntry`
- `scorePreviewQuickOpenEntry`
- `filterPreviewQuickOpenEntries`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
export type PreviewQuickOpenEntry = {
  name: string;
  path: string;
  relativePath: string;
  size?: number;
};

type RankedPreviewQuickOpenEntry = {
  entry: PreviewQuickOpenEntry;
  score: number;
};

function normalizePathForQuickOpen(value: string): string {
  return value.replace(/\\/g, "/").toLowerCase();
}

export function scorePreviewQuickOpenEntry(entry: PreviewQuickOpenEntry, query: string): number | null {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return 0;

  const relativePath = normalizePathForQuickOpen(entry.relativePath);
  const name = entry.name.toLowerCase();
  let score = relativePath.length / 100;

  for (const token of tokens) {
    const pathIndex = relativePath.indexOf(token);
    const nameIndex = name.indexOf(token);
    if (pathIndex < 0 && nameIndex < 0) return null;

    if (name === token) {
      score -= 30;
    } else if (name.startsWith(token)) {
      score -= 18;
    } else if (nameIndex >= 0) {
      score += nameIndex;
    }

    if (relativePath === token) {
      score -= 12;
    } else if (relativePath.startsWith(token)) {
      score -= 8;
    } else {
      score += Math.max(pathIndex, 0);
    }
  }

  return score;
}

export function filterPreviewQuickOpenEntries(
  entries: readonly PreviewQuickOpenEntry[],
  query: string,
  limit = 40,
): PreviewQuickOpenEntry[] {
  const ranked: RankedPreviewQuickOpenEntry[] = [];
  for (const entry of entries) {
    const score = scorePreviewQuickOpenEntry(entry, query);
    if (score === null) continue;
    ranked.push({ entry, score });
  }

  return ranked
    .sort((left, right) => (
      left.score - right.score
      || left.entry.relativePath.localeCompare(right.entry.relativePath)
    ))
    .slice(0, limit)
    .map((item) => item.entry);
}

```
