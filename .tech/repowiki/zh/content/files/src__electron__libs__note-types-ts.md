# src/electron/libs/note-types.ts

> 模块：`electron` · 语言：`typescript` · 行数：36

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `Note@3`
- `NoteCreateInput@11`
- `NoteUpdateInput@16`
- `NoteServerEvent@23`
- `NoteClientEvent@29`

## 对外暴露

- `Note`
- `NoteCreateInput`
- `NoteUpdateInput`
- `NoteServerEvent`
- `NoteClientEvent`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
// Note CRUD types — 简易笔记数据模型
// Source: project-internal CRUD demo for test workspace

export type Note = {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
};

export type NoteCreateInput = {
  title: string;
  content: string;
};

export type NoteUpdateInput = {
  title?: string;
  content?: string;
};

// IPC types for note CRUD
export type NoteServerEvent =
  | { type: "note.list"; payload: { notes: Note[] } }
  | { type: "note.created"; payload: { note: Note } }
  | { type: "note.updated"; payload: { note: Note } }
  | { type: "note.deleted"; payload: { noteId: string } }
  | { type: "note.error"; payload: { message: string } };

export type NoteClientEvent =
  | { type: "note.list" }
  | { type: "note.create"; payload: NoteCreateInput }
  | { type: "note.get"; payload: { noteId: string } }
  | { type: "note.update"; payload: { noteId: string; input: NoteUpdateInput } }
  | { type: "note.delete"; payload: { noteId: string } };

```
