# src/electron/libs/skill-manager/sync-engine.ts

> 模块：`electron` · 语言：`typescript` · 行数：291

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `syncModeForTool@22`
- `targetDirName@30`
- `ensureDstNotInsideSrc@37`
- `isTargetCurrent@54`
- `symlinkPointsTo@59`
- `removeTarget@80`
- `syncSkill@98`
- `copyDirRecursive@128`
- `is_valid_skill_dir@150`
- `readNamedFileExact@160`
- `parseFrontmatter@172`
- `parseSkillMd@192`
- `sanitizeSkillName@211`
- `inferSkillName@239`
- `hashDirectory@250`
- `collectRegularFiles@266`
- `name@32`
- `srcCanon@40`
- `dstCanon@41`
- `meta@62`
- `linkTarget@64`
- `resolvedLink@66`
- `meta@83`
- `parent@103`
- `destPath@132`
- `SKILL_DIR_MARKERS@148`
- `stat@153`
- `entries@163`
- `trimmed@174`
- `rest@178`
- `end@180`
- `yamlStr@182`
- `nameMatch@184`
- `descMatch@185`
- `content@195`
- `last@214`
- `clean@219`
- `code@221`
- `trimmed@228`
- `base@232`

## 依赖输入

- `fs`
- `path`
- `crypto`

## 对外暴露

- `SyncMode`
- `syncModeForTool`
- `targetDirName`
- `ensureDstNotInsideSrc`
- `isTargetCurrent`
- `removeTarget`
- `syncSkill`
- `SkillMeta`
- `is_valid_skill_dir`
- `parseSkillMd`
- `sanitizeSkillName`
- `inferSkillName`
- `hashDirectory`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
// Source: CV from skills-manager Rust core/sync_engine.rs + skill_metadata.rs
// Adapted for Electron TypeScript backend

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readlinkSync,
  symlinkSync,
  copyFileSync,
  rmSync,
  lstatSync,
  statSync,
  readFileSync,
} from "fs";
import { join, basename, resolve, relative } from "path";
import { createHash } from "crypto";

// ── Sync Mode ──

export type SyncMode = "symlink" | "copy";

export function syncModeForTool(_toolKey: string, configuredMode?: string | null): SyncMode {
  if (configuredMode === "copy") return "copy";
  if (configuredMode === "symlink") return "symlink";
  return "symlink";
}

// ── Target dir name ──

export function targetDirName(centralPath: string, skillName: string): string {
  const name = basename(centralPath);
  return name || skillName;
}

// ── Infinite recursion guard ──

export function ensureDstNotInsideSrc(src: string, dst: string): void {
  try {
    const srcCanon = resolve(src);
    const dstCanon = resolve(dst);
    if (dstCanon.startsWith(srcCanon + "/") || dstCanon === srcCanon) {
      throw new Error(
        `Destination ${dst} is inside source ${src}; refusing to copy to avoid infinite recursion`
      );
    }
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes("infinite recursion")) throw e;
    // If canonicalize fails, skip the check
  }
}

// ── Symlink check ──

export function isTargetCurrent(source: string, target: string, mode: SyncMode): boolean {
  if (mode === "copy") return false;
  return symlinkPointsTo(target, source);
}

function symlinkPointsTo(target: string, source: string): boolean {
  try {
    const meta = lstatSync(target);
    if (!meta.isSymbolicLink()) return false;

    const linkTarget = readlinkSync(target);
    const resolvedLink = resolve(join(target, ".."), linkTarget);
    if (resolvedLink === resolve(source)) return true;

    try {
      return resolve(resolvedLink) === resolve(source);
    } catch {
      return false;
    }
  } catch {
    return false;
  }
}

// ── Remove target ──

export function removeTarget(target: string): void {
  try {
    const meta = lstatSync(target);
    if (meta.isSymbolicLink()) {
      rmSync(target, { force: true });
    } else if (meta.isDirectory()) {
      rmSync(target, { recursive: true, force: true });
    } else {
      rmSync(target, { force: true });
    }
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return;
    throw err;
  }
}

// ── Sync skill ──

export function syncSkill(source: string, target: string, mode: SyncMode): SyncMode {
  if (isTargetCurrent(source, target, mode)) {
    return mode;
  }

  const parent = join(target, "..");
  if (!existsSync(parent)) {
    mkdirSync(parent, { recursive: true });
  }

  ensureDstNotInsideSrc(source, target);
  removeTarget(target);

  if (mode === "symlink") {
    try {
      symlinkSync(resolve(source), target, "dir");
      return "symlink";
    } catch {
      // Fallback to copy on symlink failure (e.g. Windows without privileges)
      copyDirRecursive(source, target);
      return "copy";
    }
  }

  copyDirRecursive(source, target);
  return "copy";
}

// ── Copy directory ──

function copyDirRecursive(src: string, dst: string): void {
  mkdirSync(dst, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const destPath = join(dst, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === ".git") continue;
      copyDirRecursive(join(src, entry.name), destPath);
    } else if (entry.isFile()) {
      copyFileSync(join(src, entry.name), destPath);
    }
  }
}

// ── Skill metadata parsing ──

export interface SkillMeta {
  name: string | null;
  description: string | null;
}

const SKILL_DIR_MARKERS = ["SKILL.md", "skill.md"];

export function is_valid_skill_dir(dir: string): boolean {
  try {
    const stat = statSync(dir);
    if (!stat.isDirectory()) return false;
    return SKILL_DIR_MARKERS.some((name) => existsSync(join(dir, name)));
  } catch {
    return false;
  }
}

function readNamedFileExact(dir: string, targetName: string): string | null {
  try {
    const entries
... (truncated)
```
