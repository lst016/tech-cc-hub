# src/ui/utils/workbench-url.ts

> 模块：`ui-shell` · 语言：`typescript` · 行数：32

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `extractWorkbenchUrlCandidate@5`
- `normalizeWorkbenchUrl@20`
- `WORKBENCH_URL_PATTERN@1`
- `ENCODED_SENTENCE_STOP_PATTERN@2`
- `RAW_BROWSER_SCHEME@3`
- `EXTERNAL_SCHEME@4`
- `match@7`
- `candidate@8`
- `value@22`

## 对外暴露

- `extractWorkbenchUrlCandidate`
- `normalizeWorkbenchUrl`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
const WORKBENCH_URL_PATTERN = /(?:https?:\/\/|file:\/\/\/?|(?:localhost|127\.0\.0\.1|\[::1\]):\d+|(?:\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?)(?:\/[^\s<>"'`)]*)?|\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,61}[a-z0-9](?::\d+)?(?:\/[^\s<>"'`)]*)?)[^\s<>"'`)]*/i;
const ENCODED_SENTENCE_STOP_PATTERN = /(?:%EF%BC%8C|%E3%80%82|%EF%BC%9B|%EF%BC%9A|%E3%80%81).*/i;
const RAW_BROWSER_SCHEME = /^(https?:|file:)/i;
const EXTERNAL_SCHEME = /^(?:javascript|data|mailto|tel|ftp|ssh):/i;

export function extractWorkbenchUrlCandidate(href: string): string {
  const match = href.trim().match(WORKBENCH_URL_PATTERN);
  let candidate = match?.[0] ?? href.trim();

  candidate = candidate
    .replace(ENCODED_SENTENCE_STOP_PATTERN, "")
    .replace(/[，。；：、].*$/, "")
    .replace(/(?:\*\*|__)+$/g, "")
    .replace(/\/\*+$/g, "/")
    .replace(/[.,;:!?]+$/g, "")
    .replace(/[)\]}]+$/g, "");

  return candidate;
}

export function normalizeWorkbenchUrl(href?: string): string | null {
  const value = href ? extractWorkbenchUrlCandidate(href) : "";
  if (!value) return null;
  if (EXTERNAL_SCHEME.test(value)) return null;
  if (RAW_BROWSER_SCHEME.test(value)) return value;
  if (/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/|$)/i.test(value)) return `http://${value}`;
  if (/^\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?(?:\/|$)/.test(value)) return `http://${value}`;
  if (/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+(?:\:\d+)?(?:\/.*)?$/i.test(value)) return `https://${value}`;
  if (/^(localhost|127\.0\.0\.1|\[::1\]):\d+/i.test(value)) return `http://${value}`;
  return null;
}

```
