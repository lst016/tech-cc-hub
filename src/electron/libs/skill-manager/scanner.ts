// Source: CV from skills-manager Rust core/scanner.rs + commands/scan.rs
// Adapted for Electron TypeScript backend

import { existsSync, readdirSync, readlinkSync, realpathSync, lstatSync, statSync } from "fs";
import { join, resolve } from "path";
import { randomUUID } from "crypto";
import { allToolAdapters, isInstalled, skillsDir, allScanDirs, additionalExistingScanDirs, type ToolAdapter } from "./tool-adapters.js";
import { is_valid_skill_dir, inferSkillName } from "./sync-engine.js";
import { skillsDir as centralSkillsDir } from "./central-repo.js";
import type { DiscoveredGroup, ScanResult, SkillRecord } from "./types.js";

// ── Types ──

interface DiscoveredSkillRecord {
  id: string;
  tool: string;
  found_path: string;
  name_guess: string | null;
  fingerprint: string | null;
  found_at: number;
  imported_skill_id: string | null;
}

// ── Scan ──

const RECURSIVE_SCAN_SKIP_DIRS = [
  ".hub",
  ".git",
  ".cache",
  ".next",
  ".nuxt",
  ".output",
  ".turbo",
  ".venv",
  "__pycache__",
  "build",
  "dist",
  "node_modules",
  "target",
  "vendor",
  "venv",
];

function isSymlinkToCentral(path: string): boolean {
  try {
    const link = lstatSync(path);
    if (!link.isSymbolicLink()) return false;
    const target = realpathSync(path);
    const central = realpathSync(centralSkillsDir());
    return target.startsWith(central);
  } catch {
    return false;
  }
}

function collectSkillDirsRecursive(
  dir: string,
  visited: Set<string>,
  results: string[],
): void {
  let canonical: string;
  try {
    canonical = realpathSync(dir);
  } catch {
    canonical = dir;
  }
  if (visited.has(canonical)) return;
  visited.add(canonical);

  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;

    if (RECURSIVE_SCAN_SKIP_DIRS.includes(entry.name)) continue;
    if (isSymlinkToCentral(path)) continue;

    if (is_valid_skill_dir(path)) {
      results.push(path);
      continue;
    }
    collectSkillDirsRecursive(path, visited, results);
  }
}

function pushDiscovered(
  adapterKey: string,
  path: string,
  managedPaths: string[],
  discovered: DiscoveredSkillRecord[],
): void {
  const pathStr = resolve(path);
  if (managedPaths.some((mp) => resolve(mp) === pathStr)) return;

  const name = inferSkillName(path);

  let foundAt = Date.now();
  try {
    const mtime = statSync(path).mtimeMs;
    if (mtime > 0) foundAt = mtime;
  } catch { /* ignore */ }

  discovered.push({
    id: randomUUID(),
    tool: adapterKey,
    found_path: path,
    name_guess: name,
    fingerprint: null,
    found_at: Math.floor(foundAt),
    imported_skill_id: null,
  });
}

function scanFlatDir(
  adapterKey: string,
  scanDir: string,
  managedPaths: string[],
  discovered: DiscoveredSkillRecord[],
): void {
  let entries;
  try {
    entries = readdirSync(scanDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const path = join(scanDir, entry.name);
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
    if (isSymlinkToCentral(path) || !is_valid_skill_dir(path)) continue;
    pushDiscovered(adapterKey, path, managedPaths, discovered);
  }
}

function scanRecursiveDir(
  adapterKey: string,
  scanDir: string,
  managedPaths: string[],
  discovered: DiscoveredSkillRecord[],
): void {
  const skillDirs: string[] = [];
  const visited = new Set<string>();
  collectSkillDirsRecursive(scanDir, visited, skillDirs);
  for (const path of skillDirs) {
    pushDiscovered(adapterKey, path, managedPaths, discovered);
  }
}

export function scanLocalSkillsWithAdapters(
  managedPaths: string[],
  adapters: ToolAdapter[],
): { tools_scanned: number; skills_found: number; discovered: DiscoveredSkillRecord[] } {
  const discovered: DiscoveredSkillRecord[] = [];
  let toolsScanned = 0;

  for (const adapter of adapters) {
    if (!isInstalled(adapter)) continue;

    toolsScanned++;

    const primary = skillsDir(adapter);
    if (existsSync(primary)) {
      if (adapter.recursive_scan) {
        scanRecursiveDir(adapter.key, primary, managedPaths, discovered);
      } else {
        scanFlatDir(adapter.key, primary, managedPaths, discovered);
      }
    }

    for (const scanDir of additionalExistingScanDirs(adapter)) {
      scanFlatDir(adapter.key, scanDir, managedPaths, discovered);
    }
  }

  return {
    tools_scanned: toolsScanned,
    skills_found: discovered.length,
    discovered,
  };
}

export function scanLocalSkills(
  managedPaths: string[],
): { tools_scanned: number; skills_found: number; discovered: DiscoveredSkillRecord[] } {
  return scanLocalSkillsWithAdapters(managedPaths, allToolAdapters());
}

// ── Grouping ──

export function groupDiscovered(records: DiscoveredSkillRecord[]): DiscoveredGroup[] {
  const groups = new Map<string, DiscoveredGroup>();

  for (const rec of records) {
    const name = rec.name_guess || "unknown";
    const groupKey = rec.fingerprint
      ? `fp:${name}:${rec.fingerprint}`
      : `path:${name}:${rec.found_path}`;

    let entry = groups.get(groupKey);
    if (!entry) {
      entry = {
        name,
        fingerprint: rec.fingerprint,
        locations: [],
        imported: false,
        found_at: rec.found_at,
      };
      groups.set(groupKey, entry);
    }

    if (rec.imported_skill_id) {
      entry.imported = true;
    }

    if (rec.found_at < entry.found_at) {
      entry.found_at = rec.found_at;
    }

    entry.locations.push({
      id: rec.id,
      tool: rec.tool,
      found_path: rec.found_path,
    });
  }

  const result = Array.from(groups.values());
  result.sort((a, b) => a.name.localeCompare(b.name));
  return result;
}

// ── Match imported skill ──

function canonicalizeLossy(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return resolve(path);
  }
}

export function matchImportedSkillId(
  rec: DiscoveredSkillRecord,
  managedSkills: SkillRecord[],
): string | null {
  const foundPath = canonicalizeLossy(rec.found_path);

  const byPath = managedSkills.find((skill) => {
    if (skill.source_ref && canonicalizeLossy(skill.source_ref) === foundPath) return true;
    if (skill.source_ref_resolved && canonicalizeLossy(skill.source_ref_resolved) === foundPath) return true;
    return false;
  });
  if (byPath) return byPath.id;

  if (rec.fingerprint) {
    const byFingerprint = managedSkills.find(
      (skill) => skill.content_hash === rec.fingerprint,
    );
    if (byFingerprint) return byFingerprint.id;
  }

  return null;
}
