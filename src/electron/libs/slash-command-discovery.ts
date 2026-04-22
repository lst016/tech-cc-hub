import { existsSync, readdirSync } from "fs";
import { extname, join, relative } from "path";

import { mergeSlashCommandLists } from "../../shared/slash-commands.js";

export type SlashCommandRoots = Partial<Record<"system" | "user" | "project", string>>;

export function discoverSlashCommandsInRoots(roots: SlashCommandRoots): string[] | undefined {
  const discoveredCommands: string[] = [];
  const discoveredSkills: string[] = [];

  for (const root of [roots.project, roots.user, roots.system]) {
    if (!root || !existsSync(root)) {
      continue;
    }

    const commandsRoot = join(root, "commands");
    if (existsSync(commandsRoot)) {
      for (const filePath of walkMarkdownFiles(commandsRoot)) {
        const commandName = commandNameFromCommandPath(commandsRoot, filePath);
        if (commandName) {
          discoveredCommands.push(commandName);
        }
      }
    }

    const skillsRoot = join(root, "skills");
    if (existsSync(skillsRoot)) {
      for (const filePath of walkSkillDefinitionFiles(skillsRoot)) {
        const commandName = commandNameFromSkillPath(skillsRoot, filePath);
        if (commandName) {
          discoveredSkills.push(commandName);
        }
      }
    }
  }

  return mergeSlashCommandLists(discoveredCommands, discoveredSkills);
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
  const normalized = withoutExtension.trim().replace(/\//g, ".").replace(/\.+/g, ".").replace(/^\.+|\.+$/g, "");
  return normalized || null;
}

function commandNameFromSkillPath(rootPath: string, filePath: string): string | null {
  const relativeDir = relative(rootPath, filePath).replace(/\\/g, "/").replace(/\/SKILL\.md$/i, "");
  const normalized = relativeDir.trim().replace(/\//g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || null;
}
