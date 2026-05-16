# src/electron/libs/slash-command-discovery.ts

> 模块：`electron` · 语言：`typescript` · 行数：302

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `discoverSlashCommandsInRoots@25`
- `discoverSlashCommandItemsInRoots@29`
- `clearSlashCommandDiscoveryCache@96`
- `cloneSlashCommandItems@100`
- `getDiscoveryCacheKey@104`
- `mergeSlashCommandItems@114`
- `collectUniqueSkillRoots@139`
- `discoverNestedSkillRoots@157`
- `readSlashCommandDescription@187`
- `readFrontmatterDescription@200`
- `cleanupDescription@224`
- `normalizeCommandName@232`
- `walkMarkdownFiles@237`
- `walkSkillDefinitionFiles@263`
- `commandNameFromCommandPath@289`
- `commandNameFromSkillPath@296`
- `IGNORED_SCAN_DIRS@15`
- `DISCOVERY_CACHE_TTL_MS@17`
- `discoveryCache@23`
- `cacheKey@31`
- `cached@32`
- `commandsRoot@44`
- `commandName@48`
- `skillsRoot@58`
- `commandName@62`
- `commandName@79`
- `merged@88`
- `merged@116`
- `names@117`
- `name@124`
- `key@126`
- `existing@128`
- `description@129`
- `commands@135`
- `roots@141`
- `current@167`
- `fullPath@176`
- `content@190`
- `frontmatter@191`
- `lines@202`

## 依赖输入

- `fs`
- `path`
- `../../shared/slash-commands.js`

## 对外暴露

- `SlashCommandRoots`
- `SlashCommandItem`
- `discoverSlashCommandsInRoots`
- `discoverSlashCommandItemsInRoots`
- `clearSlashCommandDiscoveryCache`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import { existsSync, readFileSync, readdirSync } from "fs";
import { extname, join, relative } from "path";

import { mergeSlashCommandLists } from "../../shared/slash-commands.js";

export type SlashCommandRoots = Partial<Record<"system" | "user" | "project", string>> & {
  skillRoots?: string[];
  skillRootContainers?: string[];
};

export type SlashCommandItem = {
  name: string;
  description?: string;
};

const IGNORED_SCAN_DIRS = new Set([".git", "node_modules"]);
const DISCOVERY_CACHE_TTL_MS = 10_000;

type DiscoveryCacheEntry = {
  items: SlashCommandItem[] | undefined;
  expiresAt: number;
};

const discoveryCache = new Map<string, DiscoveryCacheEntry>();

export function discoverSlashCommandsInRoots(roots: SlashCommandRoots): string[] | undefined {
  return mergeSlashCommandLists(discoverSlashCommandItemsInRoots(roots)?.map((command) => command.name));
}

export function discoverSlashCommandItemsInRoots(roots: SlashCommandRoots): SlashCommandItem[] | undefined {
  const cacheKey = getDiscoveryCacheKey(roots);
  const cached = discoveryCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cloneSlashCommandItems(cached.items);
  }

  const discoveredCommands: string[] = [];
  const discoveredItems: SlashCommandItem[] = [];

  for (const root of [roots.project, roots.user, roots.system]) {
    if (!root || !existsSync(root)) {
      continue;
    }

    const commandsRoot = join(root, "commands");
    if (existsSync(commandsRoot)) {
      for (const filePath of walkMarkdownFiles(commandsRoot)) {
        const commandName = commandNameFromCommandPath(commandsRoot, filePath);
        if (commandName) {
          discoveredCommands.push(commandName);
          discoveredItems.push({
            name: commandName,
            description: readSlashCommandDescription(filePath),
          });
        }
      }
    }

    const skillsRoot = join(root, "skills");
    if (existsSync(skillsRoot)) {
      for (const filePath of walkSkillDefinitionFiles(skillsRoot)) {
        const commandName = commandNameFromSkillPath(skillsRoot, filePath);
        if (commandName) {
          discoveredItems.push({
            name: commandName,
            description: readSlashCommandDescription(filePath),
          });
        }
      }
    }
  }

  for (const skillsRoot of collectUniqueSkillRoots(roots.skillRoots, roots.skillRootContainers)) {
    if (!skillsRoot || !existsSync(skillsRoot)) {
      continue;
    }

    for (const filePath of walkSkillDefinitionFiles(skillsRoot)) {
      const commandName = commandNameFromSkillPath(skillsRoot, filePath);
      if (commandName) {
        discoveredItems.push({
          name: commandName,
          description: readSlashCommandDescription(filePath),
        });
      }
    }
  }

  const merged = mergeSlashCommandItems(discoveredCommands, discoveredItems);
  discoveryCache.set(cacheKey, {
    items: cloneSlashCommandItems(merged),
    expiresAt: Date.now() + DISCOVERY_CACHE_TTL_MS,
  });
  return merged;
}

export function clearSlashCommandDiscoveryCache(): void {
  discoveryCache.clear();
}

function cloneSlashCommandItems(items: SlashCommandItem[] | undefined): SlashCommandItem[] | undefined {
  return items?.map((item) => ({ ...item }));
}

function getDiscoveryCacheKey(roots: SlashCommandRoots): string {
  return JSON.stringify({
    project: roots.project ?? "",
    skillRootContainers: [...(roots.skillRootContainers ?? [])].sort(),
    skillRoots: [...(roots.skillRoots ?? [])].sort(),
    system: roots.system ?? "",
    user: roots.user ?? "",
  });
}

function mergeSlashCommandItems(commandNames: string[], commandItems: SlashCommandItem[]): SlashCommandItem[] | undefined {
  const merged = new Map<string, SlashCommandItem>();
  const names = mergeSlashCommandLists(commandNames, commandItems.map((command) => command.name)) ?? [];

  for (const name of names) {
    merged.set(name.toLowerCase(), { name });
  }

  for (const item of commandItems) {
    const name = normalizeCommandName(item.name);
    if (!name) continue;

    const key = name.toLowerCase();
    const existing = merged.get(key);
    const description = item.description?.trim();
    merged.set
... (truncated)
```
