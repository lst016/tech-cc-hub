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
    { key: "cursor", display_name: "Cursor", relative_skills_dir: ".cursor/skills", relative_detect_dir: ".cursor", additional_scan_dirs: [], override_skills_dir: null, is_custom: false, recursive_scan: false },
    { key: "claude_code", display_name: "Claude Code", relative_skills_dir: ".claude/skills", relative_detect_dir: ".claude", additional_scan_dirs: [], override_skills_dir: null, is_custom: false, recursive_scan: false },
    { key: "codex", display_name: "Codex", relative_skills_dir: ".codex/skills", relative_detect_dir: ".codex", additional_scan_dirs: [], override_skills_dir: null, is_custom: false, recursive_scan: false },
    { key: "opencode", display_name: "OpenCode", relative_skills_dir: ".config/opencode/skills", relative_detect_dir: ".config/opencode", additional_scan_dirs: [], override_skills_dir: null, is_custom: false, recursive_scan: false },
    { key: "antigravity", display_name: "Antigravity", relative_skills_dir: ".gemini/antigravity/skills", relative_detect_dir: ".gemini/antigravity", additional_scan_dirs: [], override_skills_dir: null, is_custom: false, recursive_scan: false },
    { key: "amp", display_name: "Amp", relative_skills_dir: ".config/agents/skills", relative_detect_dir: ".config/agents", additional_scan_dirs: [], override_skills_dir: null, is_custom: false, recursive_scan: false },
    { key: "kilo_code", display_name: "Kilo Code", relative_skills_dir: ".kilocode/skills", relative_detect_dir: ".kilocode", additional_scan_dirs: [], override_skills_dir: null, is_custom: false, recursive_scan: false },
    { key: "roo_code", display_name: "Roo Code", relative_skills_dir: ".roo/skills", relative_detect_dir: ".roo", additional_scan_dirs: [], override_skills_dir: null, is_custom: false, recursive_scan: false },
    { key: "goose", display_name: "Goose", relative_skills_dir: ".config/goose/skills", relative_detect_dir: ".config/goose", additional_scan_dirs: [], override_skills_dir: null, is_custom: false, recursive_scan: false },
    { key: "gemini_cli", display_name: "Gemini CLI", relative_skills_dir: ".gemini/skills", relative_detect_dir: ".gemini", additional_scan_dirs: [], override_skills_dir: null, is_custom: false, recursive_scan: false },
    { key: "github_copilot", display_name: "GitHub Copilot", relative_skills_dir: ".copilot/skills", relative_detect_dir: ".copilot", additional_scan_dirs: [], override_skills_dir: null, is_custom: false, recursive_scan: false },
    { key: "openclaw", display_name: "OpenClaw", relative_skills_dir: ".openclaw/skills", relative_detect_dir: ".openclaw", additional_scan_dirs: [], override_skills_dir: null, is_custom: false, recursive_scan: false },
    { key: "droid", display_name: "Droid", relative_skills_dir: ".factory/skills", relative_detect_dir: ".factory", additional_scan_dirs: [], override_skills_dir: null, is_custom: false, recursive_scan: false },
    { key: "windsurf", display_name: "Windsurf", relative_skills_dir: ".codeium/windsurf/skills", relative_detect_dir: ".codeium/windsurf", additional_scan_dirs: [], override_skills_dir: null, is_custom: false, recursive_scan: false },
    { key: "trae", display_name: "TRAE IDE", relative_skills_dir: ".trae/skills", relative_detect_dir: ".trae", additional_scan_dirs: [], override_skills_dir: null, is_custom: false, recursive_scan: false },
    { key: "cline", display_name: "Cline", relative_skills_dir: ".agents/skills", relative_detect_dir: ".cline", additional_scan_dirs: [], override_skills_dir: null, is_custom: false, recursive_scan: false },
    { key: "deepagents", display_name: "Deep Agents", relative_skills_dir: ".deepagents/agent/skills", relative_detect_dir: ".deepagents", additional_scan_dirs: [], override_skills_dir: null, is_custom: false, recursive_scan: false },
    { key: "firebender", display_name: "Firebender", relative_skills_dir: ".firebender/skills", relative_detect_dir: ".firebender", additional_scan_dirs: [], override_skills_dir: null, is_custom: false, recursive_scan: false },
    { key: "kimi", display_name: "Kimi Code CLI", relative_skills_dir: ".config/agents/skills", relative_detect_dir: ".kimi", additional_scan_dirs: [], override_skills_dir: null, is_custom: false, recursive_scan: false },
    { key: "replit", display_name: "Replit", relative_skills_dir: ".config/agents/skills", relative_detect_dir: ".replit", additional_scan_dirs: [], override_skills_dir: null, is_custom: false, recursive_scan: false },
    { key: "warp", display_name: "Warp", relative_skills_dir: ".agents/skills", relative_detect_dir: ".warp", additional_scan_dirs: [], override_skills_dir: null, is_custom: false, recursive_scan: false },
    { key: "augment", display_name: "Augment", relative_skills_dir: ".augment/skills", relative_detect_dir: ".augment", additional_scan_dirs: [], override_skills_dir: null, is_custom: false, recursive_scan: false },
    { key: "bob", display_name: "IBM Bob", relative_skills_dir: ".bob/skills", relative_detect_dir: ".bob", additional_scan_dirs: [], override_skills_dir: null, is_custom: false, recursive_scan: false },
    { key: "codebuddy", display_name: "CodeBuddy", relative_skills_dir: ".codebuddy/skills", relative_detect_dir: ".codebuddy", additional_scan_dirs: [], override_skills_dir: null, is_custom: false, recursive_scan: false },
    { key: "command_code", display_name: "Command Code", relative_skills_dir: ".commandcode/skills", relative_detect_dir: ".commandcode", additional_scan_dirs: [], override_skills_dir: null, is_custom: false, recursive_scan: false },
    { key: "continue", display_name: "Continue", relative_skills_dir: ".continue/skills", relative_detect_dir: ".continue", additional_scan_dirs: [], override_skills_dir: null, is_custom: false, recursive_scan: false },
    { key: "cortex", display_name: "Cortex Code", relative_skills_dir: ".snowflake/cortex/skills", relative_detect_dir: ".snowflake/cortex", additional_scan_dirs: [], override_skills_dir: null, is_custom: false, recursive_scan: false },
    { key: "crush", display_name: "Crush", relative_skills_dir: ".config/crush/skills", relative_detect_dir: ".config/crush", additional_scan_dirs: [], override_skills_dir: null, is_custom: false, recursive_scan: false },
    { key: "iflow", display_name: "iFlow CLI", relative_skills_dir: ".iflow/skills", relative_detect_dir: ".iflow", additional_scan_dirs: [], override_skills_dir: null, is_custom: false, recursive_scan: false },
    { key: "junie", display_name: "Junie", relative_skills_dir: ".junie/skills", relative_detect_dir: ".junie", additional_scan_dirs: [], override_skills_dir: null, is_custom: false, recursive_scan: false },
    { key: "kiro", display_name: "Kiro CLI", relative_skills_dir: ".kiro/skills", relative_detect_dir: ".kiro", additional_scan_dirs: [], override_skills_dir: null, is_custom: false, recursive_scan: false },
    { key: "kode", display_name: "Kode", relative_skills_dir: ".kode/skills", relative_detect_dir: ".kode", additional_scan_dirs: [], override_skills_dir: null, is_custom: false, recursive_scan: false },
    { key: "mcpjam", display_name: "MCPJam", relative_skills_dir: ".mcpjam/skills", relative_detect_dir: ".mcpjam", additional_scan_dirs: [], override_skills_dir: null, is_custom: false, recursive_scan: false },
    { key: "mistral_vibe", display_name: "Mistral Vibe", relative_skills_dir: ".vibe/skills", relative_detect_dir: ".vibe", additional_scan_dirs: [], override_skills_dir: null, is_custom: false, recursive_scan: false },
    { key: "mux", display_name: "Mux", relative_skills_dir: ".mux/skills", relative_detect_dir: ".mux", additional_scan_dirs: [], override_skills_dir: null, is_custom: false, recursive_scan: false },
    { key: "neovate", display_name: "Neovate", relative_skills_dir: ".neovate/skills", relative_detect_dir: ".neovate", additional_scan_dirs: [], override_skills_dir: null, is_custom: false, recursive_scan: false },
    { key: "openhands", display_name: "OpenHands", relative_skills_dir: ".openhands/skills", relative_detect_dir: ".openhands", additional_scan_dirs: [], override_skills_dir: null, is_custom: false, recursive_scan: false },
    { key: "pi", display_name: "Pi", relative_skills_dir: ".pi/agent/skills", relative_detect_dir: ".pi/agent", additional_scan_dirs: [], override_skills_dir: null, is_custom: false, recursive_scan: false },
    { key: "pochi", display_name: "Pochi", relative_skills_dir: ".pochi/skills", relative_detect_dir: ".pochi", additional_scan_dirs: [], override_skills_dir: null, is_custom: false, recursive_scan: false },
    { key: "qoder", display_name: "Qoder", relative_skills_dir: ".qoder/skills", relative_detect_dir: ".qoder", additional_scan_dirs: [], override_skills_dir: null, is_custom: false, recursive_scan: false },
    { key: "qwen_code", display_name: "Qwen Code", relative_skills_dir: ".qwen/skills", relative_detect_dir: ".qwen", additional_scan_dirs: [], override_skills_dir: null, is_custom: false, recursive_scan: false },
    { key: "trae_cn", display_name: "TRAE CN", relative_skills_dir: ".trae-cn/skills", relative_detect_dir: ".trae-cn", additional_scan_dirs: [], override_skills_dir: null, is_custom: false, recursive_scan: false },
    { key: "zencoder", display_name: "Zencoder", relative_skills_dir: ".zencoder/skills", relative_detect_dir: ".zencoder", additional_scan_dirs: [], override_skills_dir: null, is_custom: false, recursive_scan: false },
    { key: "adal", display_name: "AdaL", relative_skills_dir: ".adal/skills", relative_detect_dir: ".adal", additional_scan_dirs: [], override_skills_dir: null, is_custom: false, recursive_scan: false },
    { key: "hermes", display_name: "Hermes Agent", relative_skills_dir: ".hermes/skills", relative_detect_dir: ".hermes", additional_scan_dirs: [], override_skills_dir: null, is_custom: false, recursive_scan: true },
  ];
}

export function customToolPaths(): Record<string, string> {
  try {
    const raw = getSetting("custom_tool_paths");
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

export function customTools(): CustomToolDef[] {
  try {
    const raw = getSetting("custom_tools");
    if (raw) {
      const parsed = JSON.parse(raw);
      // Handle both JSON string and already-parsed object
      return typeof parsed === "string" ? JSON.parse(parsed) : parsed;
    }
  } catch { /* ignore */ }
  return [];
}

export function allToolAdapters(): ToolAdapter[] {
  const overrides = customToolPaths();
  const customs = customTools();

  const adapters: ToolAdapter[] = defaultToolAdapters().map((a) => {
    if (overrides[a.key]) {
      return { ...a, override_skills_dir: overrides[a.key] };
    }
    return a;
  });

  for (const ct of customs) {
    adapters.push({
      key: ct.key,
      display_name: ct.display_name,
      relative_skills_dir: ct.project_relative_skills_dir || "",
      relative_detect_dir: "",
      additional_scan_dirs: [],
      override_skills_dir: ct.skills_dir,
      is_custom: true,
      recursive_scan: false,
    });
  }

  return adapters;
}

export function findAdapter(key: string): ToolAdapter | undefined {
  return defaultToolAdapters().find((a) => a.key === key);
}

export function findAdapterWithStore(key: string): ToolAdapter | undefined {
  const builtin = defaultToolAdapters().find((a) => a.key === key);
  if (builtin) {
    const overrides = customToolPaths();
    if (overrides[key]) {
      return { ...builtin, override_skills_dir: overrides[key] };
    }
    return builtin;
  }

  const ct = customTools().find((c) => c.key === key);
  if (ct) {
    return {
      key: ct.key,
      display_name: ct.display_name,
      relative_skills_dir: ct.project_relative_skills_dir || "",
      relative_detect_dir: "",
      additional_scan_dirs: [],
      override_skills_dir: ct.skills_dir,
      is_custom: true,
      recursive_scan: false,
    };
  }

  return undefined;
}

export function enabledInstalledAdapters(): ToolAdapter[] {
  let disabled: string[] = [];
  try {
    const raw = getSetting("disabled_tools");
    if (raw) disabled = JSON.parse(raw);
  } catch { /* ignore */ }

  return allToolAdapters().filter((a) => isInstalled(a) && !disabled.includes(a.key));
}
