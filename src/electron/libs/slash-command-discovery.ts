import { existsSync, readFileSync, readdirSync } from "fs";
import { extname, join, relative } from "path";

import { mergeSlashCommandLists } from "../../shared/slash-commands.js";

export type SlashCommandRoots = Partial<Record<"system" | "user" | "project", string>> & {
  skillRoots?: string[];
  skillRootContainers?: string[];
};

export type SlashCommandItem = {
  name: string;
  description?: string;
};

export type SkillDefinitionItem = SlashCommandItem & {
  filePath: string;
  definitionKind: "skill";
};

export type SlashCommandDefinitionItem = SlashCommandItem & {
  filePath: string;
  definitionKind: "command" | "skill";
};

const IGNORED_SCAN_DIRS = new Set([".git", "node_modules"]);
const DISCOVERY_CACHE_TTL_MS = 10_000;

type DiscoveryCacheEntry = {
  items: SlashCommandItem[] | undefined;
  expiresAt: number;
};

const discoveryCache = new Map<string, DiscoveryCacheEntry>();

export function discoverSlashCommandsInRoots(roots: SlashCommandRoots): string[] | undefined {
  return mergeSlashCommandLists(discoverSlashCommandItemsInRoots(roots)?.map((command) => command.name));
}

export function discoverSlashCommandItemsInRoots(roots: SlashCommandRoots): SlashCommandItem[] | undefined {
  const cacheKey = getDiscoveryCacheKey(roots);
  const cached = discoveryCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cloneSlashCommandItems(cached.items);
  }

  const discoveredCommands: string[] = [];
  const discoveredItems: SlashCommandItem[] = [];

  for (const root of [roots.project, roots.user, roots.system]) {
    if (!root || !existsSync(root)) {
      continue;
    }

    const commandDefinitions = discoverCommandDefinitionItemsInCommandRoot(join(root, "commands"));
    discoveredCommands.push(...commandDefinitions.map((item) => item.name));
    discoveredItems.push(...commandDefinitions);
    discoveredItems.push(...discoverSkillDefinitionItemsInSkillRoot(join(root, "skills")));
  }

  discoveredItems.push(...discoverAdditionalSkillDefinitionItems(roots));

  const merged = mergeSlashCommandItems(discoveredCommands, discoveredItems);
  discoveryCache.set(cacheKey, {
    items: cloneSlashCommandItems(merged),
    expiresAt: Date.now() + DISCOVERY_CACHE_TTL_MS,
  });
  return merged;
}

export function clearSlashCommandDiscoveryCache(): void {
  discoveryCache.clear();
}

export function discoverSkillDefinitionItemsInRoots(roots: SlashCommandRoots): SkillDefinitionItem[] {
  return discoverSlashCommandDefinitionItemsInRoots(roots)
    .filter((item): item is SkillDefinitionItem => item.definitionKind === "skill");
}

export function discoverSlashCommandDefinitionItemsInRoots(roots: SlashCommandRoots): SlashCommandDefinitionItem[] {
  const seenFiles = new Set<string>();
  const items: SlashCommandDefinitionItem[] = [];

  for (const root of [roots.project, roots.user, roots.system]) {
    if (!root || !existsSync(root)) {
      continue;
    }

    for (const item of [
      ...discoverCommandDefinitionItemsInCommandRoot(join(root, "commands")),
      ...discoverSkillDefinitionItemsInSkillRoot(join(root, "skills")),
    ]) {
      if (seenFiles.has(item.filePath)) continue;
      seenFiles.add(item.filePath);
      items.push(item);
    }
  }

  for (const item of discoverAdditionalSkillDefinitionItems(roots)) {
    if (seenFiles.has(item.filePath)) continue;
    seenFiles.add(item.filePath);
    items.push(item);
  }

  return items;
}

function cloneSlashCommandItems(items: SlashCommandItem[] | undefined): SlashCommandItem[] | undefined {
  return items?.map((item) => ({ ...item }));
}

function getDiscoveryCacheKey(roots: SlashCommandRoots): string {
  return JSON.stringify({
    project: roots.project ?? "",
    skillRootContainers: [...(roots.skillRootContainers ?? [])].sort(),
    skillRoots: [...(roots.skillRoots ?? [])].sort(),
    system: roots.system ?? "",
    user: roots.user ?? "",
  });
}

function mergeSlashCommandItems(commandNames: string[], commandItems: SlashCommandItem[]): SlashCommandItem[] | undefined {
  const merged = new Map<string, SlashCommandItem>();
  const names = mergeSlashCommandLists(commandNames, commandItems.map((command) => command.name)) ?? [];

  for (const name of names) {
    merged.set(name.toLowerCase(), { name });
  }

  for (const item of commandItems) {
    const name = normalizeCommandName(item.name);
    if (!name) continue;

    const key = name.toLowerCase();
    const existing = merged.get(key);
    const description = item.description?.trim();
    merged.set(key, {
      name: existing?.name ?? name,
      description: existing?.description || description || undefined,
    });
  }

  const commands = Array.from(merged.values()).sort((left, right) => left.name.localeCompare(right.name));
  return commands.length > 0 ? commands : undefined;
}

function collectUniqueSkillRoots(skillRoots?: string[], skillRootContainers?: string[]): string[] {
  const roots = new Set<string>();

  for (const root of skillRoots ?? []) {
    if (root) {
      roots.add(root);
    }
  }

  for (const container of skillRootContainers ?? []) {
    for (const root of discoverNestedSkillRoots(container)) {
      roots.add(root);
    }
  }

  return Array.from(roots);
}

function discoverAdditionalSkillDefinitionItems(roots: SlashCommandRoots): SkillDefinitionItem[] {
  return collectUniqueSkillRoots(roots.skillRoots, roots.skillRootContainers)
    .flatMap((skillsRoot) => discoverSkillDefinitionItemsInSkillRoot(skillsRoot));
}

function discoverCommandDefinitionItemsInCommandRoot(commandsRoot: string): SlashCommandDefinitionItem[] {
  if (!commandsRoot || !existsSync(commandsRoot)) {
    return [];
  }

  const items: SlashCommandDefinitionItem[] = [];
  for (const filePath of walkMarkdownFiles(commandsRoot)) {
    const commandName = commandNameFromCommandPath(commandsRoot, filePath);
    if (commandName) {
      items.push({
        name: commandName,
        description: readSlashCommandDescription(filePath),
        filePath,
        definitionKind: "command",
      });
    }
  }

  return items;
}

function discoverSkillDefinitionItemsInSkillRoot(skillsRoot: string): SkillDefinitionItem[] {
  if (!skillsRoot || !existsSync(skillsRoot)) {
    return [];
  }

  const items: SkillDefinitionItem[] = [];
  for (const filePath of walkSkillDefinitionFiles(skillsRoot)) {
    const commandName = commandNameFromSkillPath(skillsRoot, filePath);
    if (commandName) {
      items.push({
        name: commandName,
        description: readSlashCommandDescription(filePath),
        filePath,
        definitionKind: "skill",
      });
    }
  }

  return items;
}

function discoverNestedSkillRoots(rootPath: string, maxDepth = 5): string[] {
  if (!existsSync(rootPath)) {
    return [];
  }

  const roots: string[] = [];
  const pending: Array<{ path: string; depth: number }> = [{ path: rootPath, depth: 0 }];

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || current.depth > maxDepth || !existsSync(current.path)) {
      continue;
    }

    for (const entry of readdirSync(current.path, { withFileTypes: true })) {
      if (!entry.isDirectory() || IGNORED_SCAN_DIRS.has(entry.name)) {
        continue;
      }

      const fullPath = join(current.path, entry.name);
      if (entry.name === "skills") {
        roots.push(fullPath);
      }
      pending.push({ path: fullPath, depth: current.depth + 1 });
    }
  }

  return roots;
}

function readSlashCommandDescription(filePath: string): string | undefined {
  try {
    const content = readFileSync(filePath, "utf8");
    const frontmatter = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (frontmatter) {
      return readFrontmatterDescription(frontmatter[1]);
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function readFrontmatterDescription(frontmatter: string): string | undefined {
  const lines = frontmatter.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const inline = line.match(/^description:\s*(.*)$/);
    if (!inline) continue;

    const rawValue = inline[1].trim();
    if (rawValue === "|" || rawValue === ">") {
      const valueLines: string[] = [];
      for (let nextIndex = index + 1; nextIndex < lines.length; nextIndex += 1) {
        const nextLine = lines[nextIndex];
        if (/^\S/.test(nextLine)) break;
        valueLines.push(nextLine.trim());
      }
      return cleanupDescription(valueLines.join(rawValue === ">" ? " " : "\n"));
    }

    return cleanupDescription(rawValue);
  }

  return undefined;
}

function cleanupDescription(value?: string): string | undefined {
  const description = value
    ?.trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/\s+/g, " ");
  return description || undefined;
}

function normalizeCommandName(value: string): string | null {
  const normalized = value.trim().replace(/^\/+/, "").replace(/\.+/g, ".").replace(/^[._-]+|[._-]+$/g, "");
  return normalized || null;
}

function walkMarkdownFiles(rootPath: string): string[] {
  const files: string[] = [];
  const pending = [rootPath];

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || !existsSync(current)) {
      continue;
    }

    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(fullPath);
        continue;
      }

      if (entry.isFile() && extname(entry.name).toLowerCase() === ".md") {
        files.push(fullPath);
      }
    }
  }

  return files;
}

function walkSkillDefinitionFiles(rootPath: string): string[] {
  const files: string[] = [];
  const pending = [rootPath];

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || !existsSync(current)) {
      continue;
    }

    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(fullPath);
        continue;
      }

      if (entry.isFile() && entry.name === "SKILL.md") {
        files.push(fullPath);
      }
    }
  }

  return files;
}

function commandNameFromCommandPath(rootPath: string, filePath: string): string | null {
  const relativePath = relative(rootPath, filePath).replace(/\\/g, "/");
  const withoutExtension = relativePath.replace(/\.md$/i, "");
  const normalized = withoutExtension.trim().replace(/\//g, ".").replace(/\.+/g, ".").replace(/^[._-]+|[._-]+$/g, "");
  return normalized || null;
}

function commandNameFromSkillPath(rootPath: string, filePath: string): string | null {
  const relativeDir = relative(rootPath, filePath).replace(/\\/g, "/").replace(/\/SKILL\.md$/i, "");
  const normalized = relativeDir.trim().replace(/\//g, "-").replace(/-+/g, "-").replace(/^[._-]+|[._-]+$/g, "");
  return normalized || null;
}
