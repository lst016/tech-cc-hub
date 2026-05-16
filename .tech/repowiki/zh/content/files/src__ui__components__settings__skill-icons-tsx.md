# src/ui/components/settings/skill-icons.tsx

> 模块：`ui-shell` · 语言：`tsx` · 行数：44

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `getScenarioIconOption@39`
- `SCENARIO_ICON_MAP@37`
- `key@41`
- `ScenarioIconOption@16`

## 依赖输入

- `lucide-react`
- `../../types`

## 对外暴露

- `ScenarioIconOption`
- `SCENARIO_ICON_OPTIONS`
- `getScenarioIconOption`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```tsx
// Source: CV from skills-manager lib/scenarioIcons.tsx
import type { LucideIcon } from "lucide-react";
import {
  Blocks,
  BookOpen,
  Briefcase,
  Code2,
  FolderGit2,
  NotebookPen,
  Palette,
  Plane,
  Rocket,
  Wrench,
} from "lucide-react";
import type { Scenario } from "../../types";

export interface ScenarioIconOption {
  key: string;
  label: string;
  icon: LucideIcon;
  colorClass: string;
  activeClass: string;
}

export const SCENARIO_ICON_OPTIONS: ScenarioIconOption[] = [
  { key: "briefcase", label: "Work", icon: Briefcase, colorClass: "text-amber-300", activeClass: "border-amber-500/30 bg-amber-500/12" },
  { key: "book-open", label: "Study", icon: BookOpen, colorClass: "text-emerald-300", activeClass: "border-emerald-500/30 bg-emerald-500/12" },
  { key: "folder-git-2", label: "Open Source", icon: FolderGit2, colorClass: "text-rose-300", activeClass: "border-rose-500/30 bg-rose-500/12" },
  { key: "plane", label: "Travel", icon: Plane, colorClass: "text-yellow-300", activeClass: "border-yellow-500/30 bg-yellow-500/12" },
  { key: "code-2", label: "Build", icon: Code2, colorClass: "text-cyan-300", activeClass: "border-cyan-500/30 bg-cyan-500/12" },
  { key: "rocket", label: "Launch", icon: Rocket, colorClass: "text-orange-300", activeClass: "border-orange-500/30 bg-orange-500/12" },
  { key: "notebook-pen", label: "Notes", icon: NotebookPen, colorClass: "text-orange-300", activeClass: "border-orange-500/30 bg-orange-500/12" },
  { key: "blocks", label: "Systems", icon: Blocks, colorClass: "text-teal-300", activeClass: "border-teal-500/30 bg-teal-500/12" },
  { key: "palette", label: "Design", icon: Palette, colorClass: "text-pink-300", activeClass: "border-pink-500/30 bg-pink-500/12" },
  { key: "wrench", label: "Ops", icon: Wrench, colorClass: "text-zinc-300", activeClass: "border-zinc-500/30 bg-zinc-500/10" },
];

const SCENARIO_ICON_MAP = new Map(SCENARIO_ICON_OPTIONS.map((o) => [o.key, o]));

export function getScenarioIconOption(scenario?: Pick<Scenario, "name" | "description" | "icon"> | string | null): ScenarioIconOption {
  const key = typeof scenario === "string" ? scenario : (scenario?.icon || "briefcase");
  return SCENARIO_ICON_MAP.get(key) || SCENARIO_ICON_OPTIONS[0];
}

```
