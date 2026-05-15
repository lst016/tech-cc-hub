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
