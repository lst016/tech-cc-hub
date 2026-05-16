# src/electron/libs/system-workspace.ts

> 模块：`electron` · 语言：`typescript` · 行数：33

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `ensureSystemWorkspace@7`
- `SYSTEM_WORKSPACE_DIR_NAME@4`
- `README_FILE_NAME@6`
- `workspacePath@9`
- `readmePath@13`

## 依赖输入

- `electron`
- `fs`
- `path`

## 对外暴露

- `ensureSystemWorkspace`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import { app } from "electron";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const SYSTEM_WORKSPACE_DIR_NAME = "system-workspace";
const README_FILE_NAME = "README.md";

export function ensureSystemWorkspace(): string {
  const workspacePath = join(app.getPath("userData"), SYSTEM_WORKSPACE_DIR_NAME);
  if (!existsSync(workspacePath)) {
    mkdirSync(workspacePath, { recursive: true });
  }

  const readmePath = join(workspacePath, README_FILE_NAME);
  if (!existsSync(readmePath)) {
    writeFileSync(
      readmePath,
      [
        "# 系统工作区",
        "",
        "这个目录是软件内置维护 Agent 的默认工作区。",
        "",
        "- 用于系统巡检、技能治理、运行时维护等内部任务",
        "- 不代表任何用户项目",
        "- 维护会话默认会落到这里执行",
      ].join("\n"),
      "utf8",
    );
  }

  return workspacePath;
}

```
