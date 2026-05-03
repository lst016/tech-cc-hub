// Source: CV from skills-manager Rust DTOs (commands/skills.rs, commands/scenarios.rs, etc.)
// Adapted for Electron TypeScript backend

export interface ToolInfo {
  key: string;
  display_name: string;
  installed: boolean;
  skills_dir: string;
  enabled: boolean;
  is_custom: boolean;
  has_path_override: boolean;
  project_relative_skills_dir: string | null;
}

export interface ManagedSkill {
  id: string;
  name: string;
  description: string | null;
  source_type: string; // "git" | "skillssh" | "local" | "import"
  source_ref: string | null;
  source_ref_resolved: string | null;
  source_subpath: string | null;
  source_branch: string | null;
  source_revision: string | null;
  remote_revision: string | null;
  central_path: string;
  content_hash: string | null;
  enabled: boolean;
  created_at: number;
  updated_at: number;
  status: string; // "ok"
  update_status: string; // "up_to_date" | "update_available" | "local_only" | "source_missing" | "error" | "unknown"
  last_checked_at: number | null;
  last_check_error: string | null;
  targets: SkillTarget[];
  scenario_ids: string[];
  tags: string[];
}

export interface SkillTarget {
  id: string;
  skill_id: string;
  tool: string;
  target_path: string;
  mode: string; // "symlink" | "copy"
  status: string; // "ok"
  synced_at: number | null;
}

export interface SkillToolToggle {
  tool: string;
  display_name: string;
  installed: boolean;
  globally_enabled: boolean;
  enabled: boolean;
}

export interface SkillDocument {
  skill_id: string;
  filename: string;
  content: string;
  central_path: string;
}

export interface SourceSkillDocument {
  skill_id: string;
  filename: string;
  content: string;
  source_label: string;
  revision: string;
}

export interface Scenario {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  skill_count: number;
  created_at: number;
  updated_at: number;
}

export interface DiscoveredGroup {
  name: string;
  fingerprint: string | null;
  locations: Array<{ id: string; tool: string; found_path: string }>;
  imported: boolean;
  found_at: number;
}

export interface ScanResult {
  tools_scanned: number;
  skills_found: number;
  groups: DiscoveredGroup[];
}

export interface SkillsShSkill {
  id: string;
  skill_id: string;
  name: string;
  source: string;
  installs: number;
}

export interface BatchImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export interface BatchDeleteSkillsResult {
  deleted: number;
  failed: string[];
}

export interface BatchUpdateSkillsResult {
  refreshed: number;
  unchanged: number;
  failed: string[];
}

export interface UpdateSkillResult {
  skill: ManagedSkill;
  content_changed: boolean;
}

export interface GitSkillPreview {
  dir_name: string;
  name: string;
  description: string | null;
}

export interface GitPreviewResult {
  temp_dir: string;
  skills: GitSkillPreview[];
}

export interface SkillRecord {
  id: string;
  name: string;
  description: string | null;
  source_type: string;
  source_ref: string | null;
  source_ref_resolved: string | null;
  source_subpath: string | null;
  source_branch: string | null;
  source_revision: string | null;
  remote_revision: string | null;
  central_path: string;
  content_hash: string | null;
  enabled: boolean;
  created_at: number;
  updated_at: number;
  status: string;
  update_status: string;
  last_checked_at: number | null;
  last_check_error: string | null;
}

export interface ScenarioRecord {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  created_at: number;
  updated_at: number;
}

export interface SkillTargetRecord {
  id: string;
  skill_id: string;
  tool: string;
  target_path: string;
  mode: string;
  status: string;
  synced_at: number | null;
  last_error: string | null;
}
