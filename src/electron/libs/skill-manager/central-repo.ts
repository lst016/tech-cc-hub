// Source: CV from skills-manager Rust core/central_repo.rs
// Adapted for Electron TypeScript backend

import { existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { createHash } from "crypto";
import { readdirSync, readFileSync, statSync } from "fs";

const DEFAULT_CENTRAL_REPO_DIR = join(homedir(), ".skills-manager");

export function skillsDir(): string {
  return join(centralRepoBaseDir(), "skills");
}

export function centralRepoBaseDir(): string {
  // Allow override via settings (lazy-loaded)
  try {
    const { getSetting } = require("./db.js");
    const override = getSetting("central_repo_path");
    if (override && override.trim()) {
      return override.trim();
    }
  } catch {
    // db module not yet initialized, use default
  }
  return DEFAULT_CENTRAL_REPO_DIR;
}

export function ensureSkillsDir(): string {
  const dir = skillsDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function ensureCentralRepo(): string {
  const dir = centralRepoBaseDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  ensureSkillsDir();
  return dir;
}

/**
 * Compute a content hash of a skill directory. Only hashes regular file contents,
 * ignoring dotfiles and node_modules. Results are deterministic (sorted paths).
 */
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

/**
 * Compute content hash of a file or directory.
 */
export function hashLocalSource(sourcePath: string): string {
  const stat = statSync(sourcePath);
  if (stat.isDirectory()) {
    return hashDirectory(sourcePath);
  }
  // For archive files (.zip, .skill)
  const content = readFileSync(sourcePath);
  return createHash("sha256").update(content).digest("hex");
}
