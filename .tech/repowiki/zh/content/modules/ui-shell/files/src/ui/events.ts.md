# src/ui/events.ts

> 模块：`ui-shell` · 语言：`typescript` · 行数：25

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `PROMPT_FOCUS_EVENT@1`
- `PROMPT_SUBMIT_EVENT@2`
- `PROMPT_SENT_EVENT@3`
- `PREVIEW_OPEN_FILE_EVENT@4`
- `OPEN_BROWSER_WORKBENCH_URL_EVENT@5`
- `ADD_PROMPT_ATTACHMENT_EVENT@6`
- `PreviewOpenFileDetail@7`
- `OpenBrowserWorkbenchUrlDetail@12`
- `AddPromptAttachmentDetail@16`

## 对外暴露

- `PROMPT_FOCUS_EVENT`
- `PROMPT_SUBMIT_EVENT`
- `PROMPT_SENT_EVENT`
- `PREVIEW_OPEN_FILE_EVENT`
- `OPEN_BROWSER_WORKBENCH_URL_EVENT`
- `ADD_PROMPT_ATTACHMENT_EVENT`
- `PreviewOpenFileDetail`
- `OpenBrowserWorkbenchUrlDetail`
- `AddPromptAttachmentDetail`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
export const PROMPT_FOCUS_EVENT = "techcc:prompt-focus";
export const PROMPT_SUBMIT_EVENT = "techcc:prompt-submit";
export const PROMPT_SENT_EVENT = "techcc:prompt-sent";
export const PREVIEW_OPEN_FILE_EVENT = "techcc:preview-open-file";
export const OPEN_BROWSER_WORKBENCH_URL_EVENT = "tech-cc-hub:open-browser-workbench-url";
export const ADD_PROMPT_ATTACHMENT_EVENT = "techcc:add-prompt-attachment";

export type PreviewOpenFileDetail = {
  filePath: string;
  startLine?: number;
};

export type OpenBrowserWorkbenchUrlDetail = {
  url: string;
};

export type AddPromptAttachmentDetail = {
  kind: "image";
  name?: string;
  mimeType: string;
  data: string;
  preview?: string;
  size?: number;
};

```
