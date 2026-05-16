# src/electron/libs/skill-manager/tool-adapters.ts

> 模块：`electron` · 语言：`typescript` · 行数：232

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `home@30`
- `candidatePaths@34`
- `selectExistingOrDefault@49`
- `skillsDir@53`
- `isInstalled@61`
- `hasPathOverride@68`
- `allScanDirs@72`
- `additionalExistingScanDirs@82`
- `defaultToolAdapters@95`
- `customToolPaths@144`
- `customTools@152`
- `allToolAdapters@164`
- `findAdapter@191`
- `findAdapterWithStore@195`
- `enabledInstalledAdapters@222`
- `candidates@36`
- `suffix@39`
- `configDir@40`
- `configPath@41`
- `candidates@58`
- `dirs@74`
- `candidates@86`
- `raw@147`
- `raw@155`
- `parsed@157`
- `overrides@166`
- `customs@167`
- `builtin@197`
- `overrides@199`
- `ct@205`
- `raw@226`
- `ToolAdapter@8`
- `CustomToolDef@23`

## 依赖输入

- `os`
- `path`
- `fs`
- `./db.js`

## 对外暴露

- `ToolAdapter`
- `CustomToolDef`
- `skillsDir`
- `isInstalled`
- `hasPathOverride`
- `allScanDirs`
- `additionalExistingScanDirs`
- `defaultToolAdapters`
- `customToolPaths`
- `customTools`
- `allToolAdapters`
- `findAdapter`
- `findAdapterWithStore`
- `enabledInstalledAdapters`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
// Source: CV from skills-manager Rust core/tool_adapters.rs
// Adapted for Electron TypeScript backend

import { homedir } from "os";
import { join } from "path";
import { existsSync } from "fs";
import { getSetting } from "./db.js";

export interface ToolAdapter {
  key: string;
  display_name: string;
  relative_skills_dir: string;
  relative_detect_dir: string;
  /** Additional directories to scan for skills (discovery only, not deployment). */
  additional_scan_dirs: string[];
  /** When set, overrides the computed skills_dir with this absolute path. */
  override_skills_dir: string | null;
  /** Whether this is a user-defined custom agent (not built-in). */
  is_custom: boolean;
  /** When true, scan the skills directory recursively for skill directories. */
  recursive_scan: boolean;
}

export interface CustomToolDef {
  key: string;
  display_name: string;
  skills_dir: string;
  project_relative_skills_dir: string | null;
}

function home(): string {
  return homedir();
}

function candidatePaths(relative: string): string[] {
  const candidates = [join(home(), relative)];

  if (relative.startsWith(".config/")) {
    const suffix = relative.slice(".config/".length);
    const configDir = process.env.XDG_CONFIG_HOME || join(home(), ".config");
    const configPath = join(configDir, suffix);
    if (!candidates.includes(configPath)) {
      candidates.push(configPath);
    }
  }

  return candidates;
}

function selectExistingOrDefault(paths: string[]): string {
  return paths.find((p) => existsSync(p)) || paths[0];
}

export function skillsDir(adapter: ToolAdapter): string {
  if (adapter.override_skills_dir) {
    return adapter.override_skills_dir;
  }
  const candidates = candidatePaths(adapter.relative_skills_dir);
  return selectExistingOrDefault(candidates);
}

export function isInstalled(adapter: ToolAdapter): boolean {
  if (adapter.is_custom || adapter.override_skills_dir !== null) {
    return true;
  }
  return candidatePaths(adapter.relative_detect_dir).some((path) => existsSync(path));
}

export function hasPathOverride(adapter: ToolAdapter): boolean {
  return adapter.override_skills_dir !== null;
}

export function allScanDirs(adapter: ToolAdapter): string[] {
  const dirs = [skillsDir(adapter)];
  for (const c of additionalExistingScanDirs(adapter)) {
    if (!dirs.includes(c)) {
      dirs.push(c);
    }
  }
  return dirs;
}

export function additionalExistingScanDirs(adapter: ToolAdapter): string[] {
  const dirs: string[] = [];
  for (const rel of adapter.additional_scan_dirs) {
    const candidates = candidatePaths(rel);
    for (const c of candidates) {
      if (existsSync(c) && !dirs.includes(c)) {
        dirs.push(c);
      }
    }
  }
  return dirs;
}

export function defaultToolAdapters(): ToolAdapter[] {
  return [
    { key: "claude_code", display_name: "Claude Code", relative_skills_dir: ".claude/skills", relative_detect_dir: ".claude", additional_scan_dirs: [], override_skills_dir: null, is_custom: false, recursive_scan: false },
    { key: "codex", display_name: "Codex", relative_skills_dir: ".codex/skills", relative_detect_dir: ".codex", additional_scan_dirs: [], override_skills_dir: null, is_custom: false, recursive_scan: false },
    { key: "opencode", display_name: "OpenCode", relative_skills_dir: ".config/opencode/skills", relative_detect_dir: ".config/opencode", additional_scan_dirs: [], override_skills_dir: null, is_custom: false, recursive_scan: false },
    { key: "antigravity", display_name: "Antigravity", relative_skills_dir: ".gemini/antigravity/skills", relative_detect_dir: ".gemini/antigravity", additional_scan_dirs: [], override_skills_dir: null, is_custom: false, recursive_scan: false },
    { key: "amp", display_name: "Amp", relative_skills_dir: ".config/agents/skills", relative_detect_dir: ".config/agents", additional_scan_dirs: [], override_skills_dir: null, is_custom: false, recursive_scan: false },
    { key: "kilo_code", display_name: "Kilo Code", relative_skills_dir: ".kilocode/skills", relative_detect_dir: ".kilocode", additional_scan_dirs: [], override_skills_dir: null, is_custom: false, recursive_scan: false },
    { key: "roo_code", display_name: "Roo Code"
... (truncated)
```
