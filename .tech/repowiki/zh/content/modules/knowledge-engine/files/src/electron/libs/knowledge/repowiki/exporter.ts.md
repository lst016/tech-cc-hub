# src/electron/libs/knowledge/repowiki/exporter.ts

> 模块：`knowledge-engine` · 语言：`typescript` · 行数：44

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `exportRepoWikiMarkdown@4`
- `buildSidebarMarkdown@24`
- `writeSidebarItem@32`
- `pagePath@13`
- `sidebarPath@18`
- `lines@26`
- `indent@34`

## 依赖输入

- `fs`
- `path`
- `./types.js`

## 对外暴露

- `exportRepoWikiMarkdown`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { dirname, join, relative } from "path";
import type { RepoWiki, SidebarItem } from "./types.js";

export function exportRepoWikiMarkdown(wiki: RepoWiki, outputDir: string, workspaceRoot: string): string[] {
  if (existsSync(outputDir)) {
    rmSync(outputDir, { recursive: true, force: true });
  }
  mkdirSync(outputDir, { recursive: true });

  const generated: string[] = [];
  for (const page of wiki.pages) {
    const pagePath = join(outputDir, `${page.id}.md`);
    mkdirSync(dirname(pagePath), { recursive: true });
    writeFileSync(pagePath, `${page.content.trim()}\n`, "utf8");
    generated.push(relative(workspaceRoot, pagePath));
  }

  const sidebarPath = join(outputDir, "_sidebar.md");
  writeFileSync(sidebarPath, buildSidebarMarkdown(wiki), "utf8");
  generated.push(relative(workspaceRoot, sidebarPath));
  return generated;
}

function buildSidebarMarkdown(wiki: RepoWiki): string {
  const lines = [`# ${wiki.projectName}`, ""];
  for (const item of wiki.sidebar) {
    writeSidebarItem(lines, item, 0);
  }
  return `${lines.join("\n")}\n`;
}

function writeSidebarItem(lines: string[], item: SidebarItem, depth: number): void {
  const indent = "  ".repeat(depth);
  if (item.pageId) {
    lines.push(`${indent}- [${item.title}](${item.pageId}.md)`);
  } else {
    lines.push(`${indent}- **${item.title}**`);
  }
  for (const child of item.children) {
    writeSidebarItem(lines, child, depth + 1);
  }
}

```
