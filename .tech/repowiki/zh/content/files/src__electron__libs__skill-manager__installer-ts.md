# src/electron/libs/skill-manager/installer.ts

> 模块：`electron` · 语言：`typescript` · 行数：128

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `installFromLocal@30`
- `installFromGitDir@34`
- `installFromLocalToDestination@38`
- `installSkillDirToDestination@52`
- `resolveLocalSkillName@77`
- `hashLocalSource@83`
- `copySkillDir@89`
- `uniqueSkillDest@105`
- `skillName@44`
- `dest@47`
- `meta@58`
- `contentHash@67`
- `destPath@96`
- `sourceHash@107`
- `candidate@110`
- `existingHash@119`
- `InstallResult@21`

## 依赖输入

- `fs`
- `path`
- `./central-repo.js`
- `./sync-engine.js`

## 对外暴露

- `InstallResult`
- `installFromLocal`
- `installFromGitDir`
- `installFromLocalToDestination`
- `installSkillDirToDestination`
- `resolveLocalSkillName`
- `hashLocalSource`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
// Source: CV from skills-manager Rust core/installer.rs
// Adapted for Electron TypeScript backend

import {
  existsSync,
  mkdirSync,
  readdirSync,
  copyFileSync,
  rmSync,
  statSync,
} from "fs";
import { join, basename } from "path";
import { skillsDir } from "./central-repo.js";
import {
  inferSkillName,
  sanitizeSkillName,
  hashDirectory,
  parseSkillMd,
  ensureDstNotInsideSrc,
} from "./sync-engine.js";

export interface InstallResult {
  name: string;
  description: string | null;
  central_path: string;
  content_hash: string;
}

// ── Public API ──

export function installFromLocal(source: string, name?: string | null): InstallResult {
  return installFromLocalToDestination(source, name || null, undefined);
}

export function installFromGitDir(source: string, name?: string | null): InstallResult {
  return installFromLocal(source, name);
}

export function installFromLocalToDestination(
  source: string,
  name: string | null,
  destination?: string | null,
): InstallResult {
  const skillName = name
    ? sanitizeSkillName(name) || inferSkillName(source)
    : inferSkillName(source);

  const dest = destination || uniqueSkillDest(skillsDir(), skillName, source);

  return installSkillDirToDestination(source, skillName, dest);
}

export function installSkillDirToDestination(
  source: string,
  name: string,
  destination: string,
): InstallResult {
  const meta = parseSkillMd(source);

  ensureDstNotInsideSrc(source, destination);

  if (existsSync(destination)) {
    rmSync(destination, { recursive: true, force: true });
  }

  copySkillDir(source, destination);

  const contentHash = hashDirectory(destination);

  return {
    name,
    description: meta.description,
    central_path: destination,
    content_hash: contentHash,
  };
}

export function resolveLocalSkillName(source: string, name?: string | null): string {
  return name
    ? sanitizeSkillName(name) || inferSkillName(source)
    : inferSkillName(source);
}

export function hashLocalSource(source: string): string {
  return hashDirectory(source);
}

// ── Internal helpers ──

function copySkillDir(src: string, dst: string): void {
  mkdirSync(dst, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === ".DS_Store") continue;
    // Skip symlinks to prevent exfiltration of files outside the skill directory
    if (entry.isSymbolicLink()) continue;

    const destPath = join(dst, entry.name);
    if (entry.isDirectory()) {
      copySkillDir(join(src, entry.name), destPath);
    } else if (entry.isFile()) {
      copyFileSync(join(src, entry.name), destPath);
    }
  }
}

function uniqueSkillDest(parent: string, sanitizedName: string, source: string): string {
  const sourceHash = hashDirectory(source);

  for (let i = 1; i < 1000; i++) {
    const candidate = i === 1
      ? join(parent, sanitizedName)
      : join(parent, `${sanitizedName}-${i}`);

    if (!existsSync(candidate)) {
      return candidate;
    }

    try {
      const existingHash = hashDirectory(candidate);
      if (existingHash === sourceHash) {
        return candidate;
      }
    } catch { /* ignore read errors */ }
  }

  return join(parent, sanitizedName);
}

```
