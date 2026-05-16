# src/electron/libs/memory/memory-types.ts

> 模块：`electron` · 语言：`typescript` · 行数：109

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `MemoryCategory@1`
- `MemoryScope@55`
- `MemoryEntry@57`
- `MemoryCreateInput@73`
- `MemoryUpdateInput@83`
- `MemorySearchMode@87`
- `MemorySearchResult@89`
- `MemoryOverviewEntry@101`

## 对外暴露

- `MemoryCategory`
- `MEMORY_CATEGORIES`
- `MemoryScope`
- `MemoryEntry`
- `MemoryCreateInput`
- `MemoryUpdateInput`
- `MemorySearchMode`
- `MemorySearchResult`
- `MemoryOverviewEntry`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
export type MemoryCategory =
  | "project_introduction"
  | "project_tech_stack"
  | "project_build_configuration"
  | "project_environment_configuration"
  | "project_rule"
  | "project_dependency_configuration"
  | "development_code_specification"
  | "development_practice_specification"
  | "development_test_specification"
  | "development_comment_specification"
  | "common_pitfalls_experience"
  | "task_breakdown_experience"
  | "task_flow_experience"
  | "expert_experience"
  | "tool_experience"
  | "history_task_reference_files"
  | "task_summary_experience"
  | "important_decision_experience"
  | "user_info"
  | "user_hobby"
  | "user_communication"
  | "user_behavior"
  | "skill_experience"
  | "learned_skill_experience"
  | "mcp_experience";

export const MEMORY_CATEGORIES: readonly MemoryCategory[] = [
  "project_introduction",
  "project_tech_stack",
  "project_build_configuration",
  "project_environment_configuration",
  "project_rule",
  "project_dependency_configuration",
  "development_code_specification",
  "development_practice_specification",
  "development_test_specification",
  "development_comment_specification",
  "common_pitfalls_experience",
  "task_breakdown_experience",
  "task_flow_experience",
  "expert_experience",
  "tool_experience",
  "history_task_reference_files",
  "task_summary_experience",
  "important_decision_experience",
  "user_info",
  "user_hobby",
  "user_communication",
  "user_behavior",
  "skill_experience",
  "learned_skill_experience",
  "mcp_experience",
];

export type MemoryScope = "global" | `workspace:${string}`;

export type MemoryEntry = {
  id: string;
  title: string;
  content: string;
  category: MemoryCategory;
  scope: MemoryScope;
  tags: string[];
  source: "agent" | "user" | "auto";
  confidence: number;
  accessCount: number;
  lastAccessedAt?: number;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
};

export type MemoryCreateInput = {
  title: string;
  content: string;
  category: MemoryCategory;
  scope: MemoryScope;
  tags?: string[];
  source?: "agent" | "user" | "auto";
  confidence?: number;
};

export type MemoryUpdateInput = Partial<Omit<MemoryCreateInput, "scope">> & {
  scope?: MemoryScope;
};

export type MemorySearchMode = "fetch" | "shallow" | "deep" | "explore";

export type MemorySearchResult = {
  id: string;
  title: string;
  content?: string;
  snippet?: string;
  category: MemoryCategory;
  scope: MemoryScope;
  tags: string[];
  score: number;
  updatedAt: number;
};

export type MemoryOverviewEntry = {
  category: MemoryCategory;
  title: string;
  tags: string[];
  scope: MemoryScope;
  updatedAt: number;
};

```
