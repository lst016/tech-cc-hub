import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync } from "fs";
import { homedir } from "os";
import { basename, join, resolve } from "path";

import { loadSkillInventory } from "./config-store.js";

export type SkillHubSource = "builtin" | "custom" | "extension";

export type SkillHubSkillInfo = {
  name: string;
  description: string;
  location: string;
  isCustom: boolean;
  source: SkillHubSource;
};

export type SkillHubExternalSource = {
  name: string;
  path: string;
  source: string;
  skills: Array<{ name: string; description: string; path: string }>;
};

export type SkillHubBridgeResponse<T = unknown> = {
  success: boolean;
  data?: T;
  msg?: string;
  error?: string;
};

const MAX_SCAN_DEPTH = 5;
const MAX_SKILLS_PER_SOURCE = 240;
const IGNORED_DIRS = new Set([".git", "node_modules", "dist", "dist-react", "dist-electron", "coverage"]);

function resolveHomePath(input: string): string {
  const trimmed = input.trim();
  if (trimmed === "~") return homedir();
  if (trimmed.startsWith("~/") || trimmed.startsWith("~\\")) {
    return join(homedir(), ...trimmed.slice(2).split(/[\\/]/).filter(Boolean));
  }
  return trimmed;
}

function getBuiltinSkillsDir(): string {
  const candidates = [
    join(process.cwd(), "src", "electron", "resources", "skills"),
    join(process.cwd(), "doc", "00-research", "AionUi", "src", "process", "resources", "skills"),
    join(process.cwd(), "dist-electron", "skills"),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}

function parseSkillMetadata(skillDir: string): { name: string; description: string; skillMdPath: string } | null {
  const skillMdPath = join(skillDir, "SKILL.md");
  if (!existsSync(skillMdPath)) return null;

  const fallbackName = basename(skillDir);
  try {
    const content = readFileSync(skillMdPath, "utf8");
    const frontmatter = content.match(/^---\s*\n([\s\S]*?)\n---/);
    const yaml = frontmatter?.[1] ?? "";
    const name = yaml.match(/^name:\s*['"]?([^'"\n]+)['"]?\s*$/m)?.[1]?.trim() || fallbackName;
    const description = yaml.match(/^description:\s*['"]?(.+?)['"]?\s*$/m)?.[1]?.trim() || "";
    return { name, description, skillMdPath };
  } catch {
    return { name: fallbackName, description: "", skillMdPath };
  }
}

function scanSkillDirectories(rootPath: string, maxDepth: number = MAX_SCAN_DEPTH): Array<{ name: string; description: string; path: string }> {
  const root = resolveHomePath(rootPath);
  if (!existsSync(root)) return [];

  const results: Array<{ name: string; description: string; path: string }> = [];
  const seen = new Set<string>();

  const visit = (current: string, depth: number) => {
    if (results.length >= MAX_SKILLS_PER_SOURCE || depth > maxDepth) return;

    const normalized = resolve(current);
    if (seen.has(normalized)) return;
    seen.add(normalized);

    const meta = parseSkillMetadata(current);
    if (meta) {
      results.push({ name: meta.name, description: meta.description, path: current });
      return;
    }

    let entries: ReturnType<typeof readdirSync>;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (results.length >= MAX_SKILLS_PER_SOURCE) return;
      if ((!entry.isDirectory() && !entry.isSymbolicLink()) || IGNORED_DIRS.has(entry.name)) continue;
      if (entry.name.startsWith(".") && entry.name !== ".claude" && entry.name !== ".codex") continue;
      visit(join(current, entry.name), depth + 1);
    }
  };

  visit(root, 0);
  return results.sort((left, right) => left.name.localeCompare(right.name));
}

function getExternalCandidates(): Array<{ name: string; path: string; source: string }> {
  const cwd = process.cwd();
  return [
    { name: "Claude", path: join(homedir(), ".claude", "skills"), source: "claude" },
    { name: "Codex", path: join(homedir(), ".codex", "skills"), source: "codex" },
    { name: "Codex Bundled", path: join(homedir(), ".codex", "plugins", "cache", "openai-bundled"), source: "codex-bundled" },
    { name: "Project", path: join(cwd, ".claude", "skills"), source: "project" },
    { name: "AionUi Builtin", path: getBuiltinSkillsDir(), source: "aionui-builtin" },
  ];
}

function getInventoryPathSet(): Set<string> {
  const inventory = loadSkillInventory();
  return new Set(inventory.skills.map((skill) => resolve(skill.path)));
}

export function listAvailableSkills(): SkillHubSkillInfo[] {
  const inventory = loadSkillInventory();
  const builtinDir = getBuiltinSkillsDir();
  const builtinSkills = scanSkillDirectories(builtinDir, 1)
    .filter((skill) => !skill.path.includes(`${join(builtinDir, "_builtin")}`))
    .map((skill) => ({
      name: skill.name,
      description: skill.description,
      location: join(skill.path, "SKILL.md"),
      isCustom: false,
      source: "builtin" as const,
    }));

  const userSkills = inventory.skills.map((skill) => {
    const meta = parseSkillMetadata(skill.path);
    return {
      name: meta?.name || skill.name,
      description: meta?.description || skill.lastError || (skill.sourceType === "git" ? "Git tracked skill" : "Custom skill"),
      location: meta?.skillMdPath || skill.path,
      isCustom: true,
      source: "custom" as const,
    };
  });

  const byName = new Map<string, SkillHubSkillInfo>();
  for (const skill of [...builtinSkills, ...userSkills]) {
    byName.set(skill.name, skill);
  }
  return Array.from(byName.values()).sort((left, right) => left.name.localeCompare(right.name));
}

export function listBuiltinAutoSkills(): Array<{ name: string; description: string }> {
  const autoDir = join(getBuiltinSkillsDir(), "_builtin");
  return scanSkillDirectories(autoDir, 1).map((skill) => ({ name: skill.name, description: skill.description }));
}

export function getSkillPaths(): { userSkillsDir: string; builtinSkillsDir: string } {
  const inventory = loadSkillInventory();
  return {
    userSkillsDir: resolveHomePath(inventory.rootPath),
    builtinSkillsDir: getBuiltinSkillsDir(),
  };
}

export function detectAndCountExternalSkills(): SkillHubBridgeResponse<SkillHubExternalSource[]> {
  try {
    const installed = getInventoryPathSet();
    const sources = getExternalCandidates()
      .map((candidate) => {
        const skills = scanSkillDirectories(candidate.path).filter((skill) => !installed.has(resolve(skill.path)));
        return { ...candidate, skills };
      })
      .filter((source) => source.skills.length > 0);

    return {
      success: true,
      data: sources,
      msg: `Found ${sources.reduce((sum, source) => sum + source.skills.length, 0)} external skills`,
    };
  } catch (error) {
    return { success: false, msg: error instanceof Error ? error.message : String(error) };
  }
}

export function importSkillWithSymlink(skillPath: string): SkillHubBridgeResponse<{ skillName: string }> {
  try {
    const sourcePath = resolveHomePath(skillPath);
    const meta = parseSkillMetadata(sourcePath);
    if (!meta) {
      return { success: false, msg: "所选目录下没有 SKILL.md。" };
    }

    const inventory = loadSkillInventory();
    const userSkillsDir = resolveHomePath(inventory.rootPath);
    mkdirSync(userSkillsDir, { recursive: true });

    const safeName = meta.name.replace(/[\\/]/g, "-").trim() || basename(sourcePath);
    const targetPath = join(userSkillsDir, safeName);
    if (existsSync(targetPath)) {
      return { success: false, msg: `Skill "${safeName}" 已存在。` };
    }

    symlinkSync(sourcePath, targetPath, "junction");
    return { success: true, data: { skillName: safeName }, msg: `已导入 ${safeName}` };
  } catch (error) {
    return { success: false, msg: error instanceof Error ? error.message : String(error) };
  }
}

export function deleteSkill(skillName: string): SkillHubBridgeResponse {
  try {
    const inventory = loadSkillInventory();
    const userSkillsDir = resolve(resolveHomePath(inventory.rootPath));
    const targetSkill = inventory.skills.find((skill) => skill.name === skillName || basename(skill.path) === skillName);
    const targetPath = resolve(targetSkill?.path ?? join(userSkillsDir, skillName));

    if (!targetPath.startsWith(`${userSkillsDir}/`) && targetPath !== userSkillsDir) {
      return { success: false, msg: "目标 skill 不在用户 skill 目录内，已阻止删除。" };
    }
    if (!existsSync(targetPath)) {
      return { success: false, msg: `Skill "${skillName}" 不存在。` };
    }

    const stats = lstatSync(targetPath);
    rmSync(targetPath, { recursive: !stats.isSymbolicLink(), force: true });
    return { success: true, msg: `已删除 ${skillName}` };
  } catch (error) {
    return { success: false, msg: error instanceof Error ? error.message : String(error) };
  }
}
