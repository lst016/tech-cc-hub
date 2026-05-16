# src/electron/libs/skill-manager/scanner.ts

> 模块：`electron` · 语言：`typescript` · 行数：269

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `isSymlinkToCentral@43`
- `collectSkillDirsRecursive@55`
- `pushDiscovered@91`
- `scanFlatDir@119`
- `scanRecursiveDir@140`
- `scanLocalSkillsWithAdapters@154`
- `scanLocalSkills@187`
- `groupDiscovered@195`
- `canonicalizeLossy@238`
- `matchImportedSkillId@246`
- `RECURSIVE_SCAN_SKIP_DIRS@25`
- `link@46`
- `target@48`
- `central@49`
- `path@78`
- `pathStr@98`
- `name@100`
- `foundAt@102`
- `mtime@105`
- `path@134`
- `visited@148`
- `toolsScanned@160`
- `primary@166`
- `groups@197`
- `name@200`
- `groupKey@201`
- `entry@204`
- `result@231`
- `foundPath@251`
- `byPath@252`
- `byFingerprint@261`
- `DiscoveredSkillRecord@13`

## 依赖输入

- `fs`
- `path`
- `crypto`
- `./tool-adapters.js`
- `./sync-engine.js`
- `./central-repo.js`
- `./types.js`

## 对外暴露

- `scanLocalSkillsWithAdapters`
- `scanLocalSkills`
- `groupDiscovered`
- `matchImportedSkillId`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
// Source: CV from skills-manager Rust core/scanner.rs + commands/scan.rs
// Adapted for Electron TypeScript backend

import { existsSync, readdirSync, readlinkSync, realpathSync, lstatSync, statSync } from "fs";
import { join, resolve } from "path";
import { randomUUID } from "crypto";
import { allToolAdapters, isInstalled, skillsDir, allScanDirs, additionalExistingScanDirs, type ToolAdapter } from "./tool-adapters.js";
import { is_valid_skill_dir, inferSkillName } from "./sync-engine.js";
import { skillsDir as centralSkillsDir } from "./central-repo.js";
import type { DiscoveredGroup, ScanResult, SkillRecord } from "./types.js";

// ── Types ──

interface DiscoveredSkillRecord {
  id: string;
  tool: string;
  found_path: string;
  name_guess: string | null;
  fingerprint: string | null;
  found_at: number;
  imported_skill_id: string | null;
}

// ── Scan ──

const RECURSIVE_SCAN_SKIP_DIRS = [
  ".hub",
  ".git",
  ".cache",
  ".next",
  ".nuxt",
  ".output",
  ".turbo",
  ".venv",
  "__pycache__",
  "build",
  "dist",
  "node_modules",
  "target",
  "vendor",
  "venv",
];

function isSymlinkToCentral(path: string): boolean {
  try {
    const link = lstatSync(path);
    if (!link.isSymbolicLink()) return false;
    const target = realpathSync(path);
    const central = realpathSync(centralSkillsDir());
    return target.startsWith(central);
  } catch {
    return false;
  }
}

function collectSkillDirsRecursive(
  dir: string,
  visited: Set<string>,
  results: string[],
): void {
  let canonical: string;
  try {
    canonical = realpathSync(dir);
  } catch {
    canonical = dir;
  }
  if (visited.has(canonical)) return;
  visited.add(canonical);

  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;

    if (RECURSIVE_SCAN_SKIP_DIRS.includes(entry.name)) continue;
    if (isSymlinkToCentral(path)) continue;

    if (is_valid_skill_dir(path)) {
      results.push(path);
      continue;
    }
    collectSkillDirsRecursive(path, visited, results);
  }
}

function pushDiscovered(
  adapterKey: string,
  path: string,
  managedPaths: string[],
  discovered: DiscoveredSkillRecord[],
): void {
  const pathStr = resolve(path);
  if (managedPaths.some((mp) => resolve(mp) === pathStr)) return;

  const name = inferSkillName(path);

  let foundAt = Date.now();
  try {
    const mtime = statSync(path).mtimeMs;
    if (mtime > 0) foundAt = mtime;
  } catch { /* ignore */ }

  discovered.push({
    id: randomUUID(),
    tool: adapterKey,
    found_path: path,
    name_guess: name,
    fingerprint: null,
    found_at: Math.floor(foundAt),
    imported_skill_id: null,
  });
}

function scanFlatDir(
  adapterKey: string,
  scanDir: string,
  managedPaths: string[],
  discovered: DiscoveredSkillRecord[],
): void {
  let entries;
  try {
    entries = readdirSync(scanDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const path = join(scanDir, entry.name);
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
    if (isSymlinkToCentral(path) || !is_valid_skill_dir(path)) continue;
    pushDiscovered(adapterKey, path, managedPaths, discovered);
  }
}

function scanRecursiveDir(
  adapterKey: string,
  scanDir: string,
  managedPaths: string[],
  discovered: DiscoveredSkillRecord[],
): void {
  const skillDirs: string[] = [];
  const visited = new Set<string>();
  collectSkillDirsRecursive(scanDir, visited, skillDirs);
  for (const path of skillDirs) {
    pushDiscovered(adapterKey, path, managedPaths, discovered);
  }
}

export function scanLocalSkillsWithAdapters(
  managedPaths: string[],
  adapters: ToolAdapter[],
): { tools_scanned: number; skills_found: number; discovered: DiscoveredSkillRecord[] } {
  const discovered: DiscoveredSkillRecord[] = [];
  let toolsScanned = 0;

  for (const adapter of adapters) {
    if (!isInstalled(adapter)) continue;

    toolsScanned++;

    const primary = skillsDir(adapter);
    if (existsSync(primary)) {
      if (adapter.recursive_scan) {
... (truncated)
```
