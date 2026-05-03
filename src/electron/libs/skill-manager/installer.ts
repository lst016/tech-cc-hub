// Source: CV from skills-manager Rust core/installer.rs
// Adapted for Electron TypeScript backend

import {
  existsSync,
  mkdirSync,
  readdirSync,
  copyFileSync,
  rmSync,
  statSync,
} from "fs";
import { join, basename } from "path";
import { skillsDir } from "./central-repo.js";
import {
  inferSkillName,
  sanitizeSkillName,
  hashDirectory,
  parseSkillMd,
  ensureDstNotInsideSrc,
} from "./sync-engine.js";

export interface InstallResult {
  name: string;
  description: string | null;
  central_path: string;
  content_hash: string;
}

// ── Public API ──

export function installFromLocal(source: string, name?: string | null): InstallResult {
  return installFromLocalToDestination(source, name || null, undefined);
}

export function installFromGitDir(source: string, name?: string | null): InstallResult {
  return installFromLocal(source, name);
}

export function installFromLocalToDestination(
  source: string,
  name: string | null,
  destination?: string | null,
): InstallResult {
  const skillName = name
    ? sanitizeSkillName(name) || inferSkillName(source)
    : inferSkillName(source);

  const dest = destination || uniqueSkillDest(skillsDir(), skillName, source);

  return installSkillDirToDestination(source, skillName, dest);
}

export function installSkillDirToDestination(
  source: string,
  name: string,
  destination: string,
): InstallResult {
  const meta = parseSkillMd(source);

  ensureDstNotInsideSrc(source, destination);

  if (existsSync(destination)) {
    rmSync(destination, { recursive: true, force: true });
  }

  copySkillDir(source, destination);

  const contentHash = hashDirectory(destination);

  return {
    name,
    description: meta.description,
    central_path: destination,
    content_hash: contentHash,
  };
}

export function resolveLocalSkillName(source: string, name?: string | null): string {
  return name
    ? sanitizeSkillName(name) || inferSkillName(source)
    : inferSkillName(source);
}

export function hashLocalSource(source: string): string {
  return hashDirectory(source);
}

// ── Internal helpers ──

function copySkillDir(src: string, dst: string): void {
  mkdirSync(dst, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === ".DS_Store") continue;
    // Skip symlinks to prevent exfiltration of files outside the skill directory
    if (entry.isSymbolicLink()) continue;

    const destPath = join(dst, entry.name);
    if (entry.isDirectory()) {
      copySkillDir(join(src, entry.name), destPath);
    } else if (entry.isFile()) {
      copyFileSync(join(src, entry.name), destPath);
    }
  }
}

function uniqueSkillDest(parent: string, sanitizedName: string, source: string): string {
  const sourceHash = hashDirectory(source);

  for (let i = 1; i < 1000; i++) {
    const candidate = i === 1
      ? join(parent, sanitizedName)
      : join(parent, `${sanitizedName}-${i}`);

    if (!existsSync(candidate)) {
      return candidate;
    }

    try {
      const existingHash = hashDirectory(candidate);
      if (existingHash === sourceHash) {
        return candidate;
      }
    } catch { /* ignore read errors */ }
  }

  return join(parent, sanitizedName);
}
