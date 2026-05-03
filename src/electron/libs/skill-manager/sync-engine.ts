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
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name === targetName) {
        return readFileSync(join(dir, entry.name), "utf-8");
      }
    }
  } catch { /* ignore */ }
  return null;
}

function parseFrontmatter(content: string): SkillMeta {
  const trimmed = content.trim();
  if (!trimmed.startsWith("---")) {
    return { name: null, description: null };
  }

  const rest = trimmed.slice(3);
  const end = rest.indexOf("---");
  if (end === -1) return { name: null, description: null };

  const yamlStr = rest.slice(0, end);
  const nameMatch = yamlStr.match(/^name:\s*(.+)$/m);
  const descMatch = yamlStr.match(/^description:\s*(.+)$/m);

  return {
    name: nameMatch ? nameMatch[1].trim() : null,
    description: descMatch ? descMatch[1].trim() : null,
  };
}

export function parseSkillMd(dir: string): SkillMeta {
  for (const candidate of ["SKILL.md", "skill.md"]) {
    const content = readNamedFileExact(dir, candidate);
    if (content !== null) {
      return parseFrontmatter(content);
    }
  }
  return { name: null, description: null };
}

// ── Skill name sanitization ──

const WINDOWS_RESERVED: string[] = ["<", ">", ":", '"', "/", "\\", "|", "?", "*"];
const WINDOWS_RESERVED_BASENAMES: string[] = [
  "CON", "PRN", "AUX", "NUL",
  "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
  "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
];

export function sanitizeSkillName(name: string): string | null {
  // Take only the last path component
  const last = basename(name);

  if (last === ".." || last === ".") return null;

  // Replace control characters and Windows-reserved characters
  const clean = Array.from(last)
    .map((c) => {
      const code = c.charCodeAt(0);
      if (code < 32 || WINDOWS_RESERVED.includes(c)) return "_";
      return c;
    })
    .join("");

  // Trim whitespace and trailing dots
  const trimmed = clean.trim().replace(/\.+$/, "");
  if (trimmed.length === 0) return null;

  // Check Windows reserved device names
  const base = trimmed.split(".")[0].toUpperCase();
  if (WINDOWS_RESERVED_BASENAMES.includes(base)) {
    return `_${trimmed}`;
  }

  return trimmed;
}

export function inferSkillName(dir: string): string {
  const meta = parseSkillMd(dir);
  if (meta.name) {
    const sanitized = sanitizeSkillName(meta.name);
    if (sanitized) return sanitized;
  }
  return basename(dir) || "unknown-skill";
}

// ── Content hash ──

export function hashDirectory(dirPath: string): string {
  const hash = createHash("sha256");
  const files = collectRegularFiles(dirPath, dirPath);

  for (const relPath of files) {
    const fullPath = join(dirPath, relPath);
    const content = readFileSync(fullPath);
    hash.update(relPath);
    hash.update(":");
    hash.update(content);
    hash.update("\n");
  }

  return hash.digest("hex");
}

function collectRegularFiles(root: string, current: string): string[] {
  const result: string[] = [];
  let entries;
  try {
    entries = readdirSync(current, { withFileTypes: true });
  } catch {
    return result;
  }

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    if (entry.name === "node_modules") continue;

    const fullPath = join(current, entry.name);
    if (entry.isDirectory()) {
      result.push(...collectRegularFiles(root, fullPath));
    } else if (entry.isFile()) {
      result.push(fullPath.slice(root.length + 1));
    }
  }

  result.sort();
  return result;
}
