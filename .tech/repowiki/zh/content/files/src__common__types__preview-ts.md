# src/common/types/preview.ts

> 模块：`common` · 语言：`typescript` · 行数：32

## 文件职责

定义预览功能的类型系统，包括内容类型和历史记录结构

## 关键符号

- `PreviewContentType@0 - 支持的预览内容类型联合类型：code、markdown、html、image、pdf、word、excel、ppt、diff、url`
- `PreviewHistoryTarget@0 - 预览历史目标，可通过id、path、filePath定位`
- `PreviewSnapshotInfo@0 - 预览快照信息，包含id、path、title、createdAt、content`
- `RemoteImageFetchRequest@0 - 远程图片获取请求`

## 对外暴露

- `PreviewContentType`
- `PreviewHistoryTarget`
- `PreviewSnapshotInfo`
- `RemoteImageFetchRequest`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
export type PreviewContentType =
  | 'code'
  | 'markdown'
  | 'html'
  | 'image'
  | 'pdf'
  | 'word'
  | 'excel'
  | 'ppt'
  | 'diff'
  | 'url';

export type PreviewHistoryTarget = {
  id?: string;
  path?: string;
  filePath?: string;
  title?: string;
  contentType?: PreviewContentType;
};

export type PreviewSnapshotInfo = {
  id: string;
  path: string;
  title?: string;
  createdAt?: number;
  content?: string;
};

export type RemoteImageFetchRequest = {
  url: string;
};

```
