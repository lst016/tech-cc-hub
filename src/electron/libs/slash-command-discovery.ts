import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from "fs";
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from "path";

import { mergeSlashCommandLists } from "../../shared/slash-commands.js";

export type SlashCommandRoots = Partial<Record<"system" | "user" | "project", string>> & {
  skillRoots?: string[];
  skillRootContainers?: string[];
};

export type SlashCommandItem = {
  name: string;
  description?: string;
  icon?: string;
  source?: "claude-code-compat" | "claude-code-builtin" | "local" | "message";
  aliasOf?: string;
};

export type SkillDefinitionItem = SlashCommandItem & {
  filePath: string;
  definitionKind: "skill";
};

export type SlashCommandDefinitionItem = SlashCommandItem & {
  filePath: string;
  definitionKind: "command" | "skill";
};

const IGNORED_SCAN_DIRS = new Set([
  ".cache",
  ".claude",
  ".codex",
  ".git",
  ".next",
  ".tech",
  ".turbo",
  ".vite",
  "build",
  "coverage",
  "dist",
  "dist-electron",
  "dist-react",
  "dist-test",
  "node_modules",
  "out",
]);
const DISCOVERY_CACHE_TTL_MS = 10_000;
const MAX_DISCOVERY_FILES = 1_000;
const MAX_DISCOVERY_DIRS = 2_000;
const MAX_SKILL_ICON_BYTES = 64 * 1_024;
const SKILL_ICON_MIME_TYPES = new Map([
  [".gif", "image/gif"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
]);

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
    const icon = item.icon?.trim();
    merged.set(key, {
      name: existing?.name ?? name,
      description: existing?.description || description || undefined,
      icon: existing?.icon || icon || undefined,
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
    const metadata = readSlashCommandMetadata(filePath);
    const commandName = normalizeCommandName(metadata.name ?? "")
      ?? commandNameFromSkillPath(skillsRoot, filePath);
    if (commandName) {
      items.push({
        name: commandName,
        description: metadata.description,
        icon: readSkillIconDataUrl(filePath),
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
      if (!entry.isDirectory() || shouldIgnoreScanDirectory(entry.name)) {
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
  return readSlashCommandMetadata(filePath).description;
}

function readSlashCommandMetadata(filePath: string): { name?: string; description?: string } {
  try {
    const content = readFileSync(filePath, "utf8");
    const frontmatter = content.match(
      /^(?:\uFEFF)?---[^\S\r\n]*\r?\n([\s\S]*?)\r?\n---(?:[^\S\r\n]*(?:\r?\n|$))/,
    );
    if (frontmatter) {
      return {
        name: readFrontmatterName(frontmatter[1]),
        description: readFrontmatterDescription(frontmatter[1]),
      };
    }
    return {};
  } catch {
    return {};
  }
}

function readFrontmatterName(frontmatter: string): string | undefined {
  for (const line of frontmatter.split(/\r?\n/)) {
    const inline = line.match(/^name:\s*(.*)$/);
    if (inline) {
      return cleanupDescription(inline[1]);
    }
  }
  return undefined;
}

function readSkillIconDataUrl(skillFilePath: string): string | undefined {
  const skillDir = dirname(skillFilePath);
  const interfacePath = join(skillDir, "agents", "openai.yaml");
  if (!existsSync(interfacePath)) return undefined;

  let interfaceYaml: string;
  try {
    interfaceYaml = readFileSync(interfacePath, "utf8");
  } catch {
    return undefined;
  }

  const iconPaths = ["icon_small", "icon_large"]
    .map((field) => readYamlStringField(interfaceYaml, field))
    .filter((value): value is string => Boolean(value));

  for (const iconPath of iconPaths) {
    try {
      if (isAbsolute(iconPath)) continue;
      const resolvedIconPath = resolve(skillDir, iconPath);
      if (!isPathWithin(skillDir, resolvedIconPath) || !existsSync(resolvedIconPath)) continue;

      const realSkillDir = realpathSync(skillDir);
      const realIconPath = realpathSync(resolvedIconPath);
      if (!isPathWithin(realSkillDir, realIconPath)) continue;

      const mimeType = SKILL_ICON_MIME_TYPES.get(extname(realIconPath).toLowerCase());
      const iconStat = statSync(realIconPath);
      if (!mimeType || !iconStat.isFile() || iconStat.size <= 0 || iconStat.size > MAX_SKILL_ICON_BYTES) continue;

      return `data:${mimeType};base64,${readFileSync(realIconPath).toString("base64")}`;
    } catch {
      // A missing or unreadable small icon should not prevent falling back to icon_large.
    }
  }

  return undefined;
}

function readYamlStringField(yaml: string, field: string): string | undefined {
  const match = yaml.match(new RegExp(`^\\s*${field}:\\s*(.*?)\\s*$`, "m"));
  const value = cleanupDescription(match?.[1]);
  return value && value !== "null" ? value : undefined;
}

function isPathWithin(rootPath: string, candidatePath: string): boolean {
  const relativePath = relative(rootPath, candidatePath);
  return relativePath.length > 0
    && relativePath !== ".."
    && !relativePath.startsWith(`..${sep}`)
    && !isAbsolute(relativePath);
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
  let visitedDirs = 0;

  while (pending.length > 0 && files.length < MAX_DISCOVERY_FILES && visitedDirs < MAX_DISCOVERY_DIRS) {
    const current = pending.pop();
    if (!current || !existsSync(current)) {
      continue;
    }
    visitedDirs += 1;

    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        if (!shouldIgnoreScanDirectory(entry.name)) {
          pending.push(fullPath);
        }
        continue;
      }

      if (entry.isFile() && extname(entry.name).toLowerCase() === ".md") {
        files.push(fullPath);
        if (files.length >= MAX_DISCOVERY_FILES) break;
      }
    }
  }

  return files;
}

function walkSkillDefinitionFiles(rootPath: string): string[] {
  const files: string[] = [];
  const pending = [rootPath];
  let visitedDirs = 0;

  while (pending.length > 0 && files.length < MAX_DISCOVERY_FILES && visitedDirs < MAX_DISCOVERY_DIRS) {
    const current = pending.pop();
    if (!current || !existsSync(current)) {
      continue;
    }
    visitedDirs += 1;

    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        if (!shouldIgnoreScanDirectory(entry.name)) {
          pending.push(fullPath);
        }
        continue;
      }

      if (entry.isFile() && entry.name === "SKILL.md") {
        files.push(fullPath);
        if (files.length >= MAX_DISCOVERY_FILES) break;
      }
    }
  }

  return files;
}

function shouldIgnoreScanDirectory(name: string): boolean {
  return IGNORED_SCAN_DIRS.has(name);
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
