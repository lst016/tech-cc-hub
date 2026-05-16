# src/electron/libs/slash-command-catalog.ts

> 模块：`electron` · 语言：`typescript` · 行数：68

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `resolveSlashCommandRoots@10`
- `buildSessionSlashCommands@28`
- `buildSessionSlashCommandItems@39`
- `home@12`
- `discoveredItems@44`
- `messageCommands@45`
- `merged@46`
- `normalized@57`
- `key@59`
- `commands@64`

## 依赖输入

- `os`
- `path`
- `electron`
- `../types.js`
- `../../shared/slash-commands.js`
- `./slash-command-discovery.js`
- `./claude-code-compat-registry.js`

## 对外暴露

- `resolveSlashCommandRoots`
- `buildSessionSlashCommands`
- `buildSessionSlashCommandItems`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import { homedir } from "os";
import { join } from "path";

import { app } from "electron";

import type { StreamMessage } from "../types.js";
import { extractSlashCommandsFromMessages, mergeSlashCommandLists } from "../../shared/slash-commands.js";
import { discoverSlashCommandItemsInRoots, discoverSlashCommandsInRoots, type SlashCommandItem, type SlashCommandRoots } from "./slash-command-discovery.js";
import { CLAUDE_CODE_COMPAT_COMMAND_ITEMS } from "./claude-code-compat-registry.js";

export function resolveSlashCommandRoots(cwd?: string): SlashCommandRoots {
  const home = homedir();
  return {
    system: join(app.getPath("userData"), "system-claude"),
    user: join(home, ".claude"),
    project: cwd?.trim() ? join(cwd.trim(), ".claude") : undefined,
    skillRoots: [
      join(home, ".claude", "skills"),
      join(home, ".codex", "skills"),
      join(home, ".codex", "vendor_imports", "skills"),
      join(home, ".skills-manager", "skills"),
    ],
    skillRootContainers: [
      join(home, ".codex", "plugins", "cache"),
    ],
  };
}

export function buildSessionSlashCommands(options: {
  cwd?: string;
  messages?: StreamMessage[];
}): string[] | undefined {
  return mergeSlashCommandLists(
    CLAUDE_CODE_COMPAT_COMMAND_ITEMS.map((item) => item.name),
    discoverSlashCommandsInRoots(resolveSlashCommandRoots(options.cwd)),
    extractSlashCommandsFromMessages(options.messages),
  );
}

export function buildSessionSlashCommandItems(options: {
  cwd?: string;
  messages?: StreamMessage[];
}): SlashCommandItem[] | undefined {
  const discoveredItems = discoverSlashCommandItemsInRoots(resolveSlashCommandRoots(options.cwd)) ?? [];
  const messageCommands = extractSlashCommandsFromMessages(options.messages) ?? [];
  const merged = new Map<string, SlashCommandItem>();

  for (const item of CLAUDE_CODE_COMPAT_COMMAND_ITEMS) {
    merged.set(item.name.toLowerCase(), item);
  }

  for (const item of discoveredItems) {
    merged.set(item.name.toLowerCase(), item);
  }

  for (const name of messageCommands) {
    const normalized = name.trim().replace(/^\/+/, "");
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (!merged.has(key)) {
      merged.set(key, { name: normalized });
    }
  }

  const commands = Array.from(merged.values()).sort((left, right) => left.name.localeCompare(right.name));
  return commands.length > 0 ? commands : undefined;
}

```
