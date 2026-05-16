# src/electron/libs/skill-manager/central-repo.ts

> 模块：`electron` · 语言：`typescript` · 行数：104

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `skillsDir@11`
- `centralRepoBaseDir@15`
- `ensureSkillsDir@29`
- `ensureCentralRepo@37`
- `hashDirectory@51`
- `collectRegularFiles@66`
- `hashLocalSource@95`
- `DEFAULT_CENTRAL_REPO_DIR@9`
- `override@20`
- `dir@31`
- `dir@39`
- `hash@52`
- `files@53`
- `fullPath@56`
- `content@57`
- `fullPath@79`
- `stat@96`
- `content@101`

## 依赖输入

- `fs`
- `os`
- `path`
- `crypto`
- `./db.js`

## 对外暴露

- `skillsDir`
- `centralRepoBaseDir`
- `ensureSkillsDir`
- `ensureCentralRepo`
- `hashDirectory`
- `hashLocalSource`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
// Source: CV from skills-manager Rust core/central_repo.rs
// Adapted for Electron TypeScript backend

import { existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { createHash } from "crypto";
import { readdirSync, readFileSync, statSync } from "fs";

const DEFAULT_CENTRAL_REPO_DIR = join(homedir(), ".skills-manager");

export function skillsDir(): string {
  return join(centralRepoBaseDir(), "skills");
}

export function centralRepoBaseDir(): string {
  // Allow override via settings (lazy-loaded)
  try {
    const { getSetting } = require("./db.js");
    const override = getSetting("central_repo_path");
    if (override && override.trim()) {
      return override.trim();
    }
  } catch {
    // db module not yet initialized, use default
  }
  return DEFAULT_CENTRAL_REPO_DIR;
}

export function ensureSkillsDir(): string {
  const dir = skillsDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function ensureCentralRepo(): string {
  const dir = centralRepoBaseDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  ensureSkillsDir();
  return dir;
}

/**
 * Compute a content hash of a skill directory. Only hashes regular file contents,
 * ignoring dotfiles and node_modules. Results are deterministic (sorted paths).
 */
export function hashDirectory(dirPath: string): string {
  const hash = createHash("sha256");
  const files = collectRegularFiles(dirPath, dirPath);

  for (const relPath of files) {
    const fullPath = join(dirPath, relPath);
    const content = readFileSync(fullPath);
    hash.update(relPath);
    hash.update(":");
    hash.update(content);
    hash.update("\n");
  }

  return hash.digest("hex");
}

function collectRegularFiles(root: string, current: string): string[] {
  const result: string[] = [];
  let entries;
  try {
    entries = readdirSync(current, { withFileTypes: true });
  } catch {
    return result;
  }

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    if (entry.name === "node_modules") continue;

    const fullPath = join(current, entry.name);
    if (entry.isDirectory()) {
      result.push(...collectRegularFiles(root, fullPath));
    } else if (entry.isFile()) {
      result.push(fullPath.slice(root.length + 1));
    }
  }

  result.sort();
  return result;
}

/**
 * Compute content hash of a file or directory.
 */
export function hashLocalSource(sourcePath: string): string {
  const stat = statSync(sourcePath);
  if (stat.isDirectory()) {
    return hashDirectory(sourcePath);
  }
  // For archive files (.zip, .skill)
  const content = readFileSync(sourcePath);
  return createHash("sha256").update(content).digest("hex");
}

```
