import { homedir } from "os";
import { join } from "path";

import { app } from "electron";

import type { StreamMessage } from "../types.js";
import { extractSlashCommandsFromMessages, mergeSlashCommandLists } from "../../shared/slash-commands.js";
import { discoverSlashCommandsInRoots, type SlashCommandRoots } from "./slash-command-discovery.js";

export function resolveSlashCommandRoots(cwd?: string): SlashCommandRoots {
  return {
    system: join(app.getPath("userData"), "system-claude"),
    user: join(homedir(), ".claude"),
    project: cwd?.trim() ? join(cwd.trim(), ".claude") : undefined,
  };
}

export function buildSessionSlashCommands(options: {
  cwd?: string;
  messages?: StreamMessage[];
}): string[] | undefined {
  return mergeSlashCommandLists(
    discoverSlashCommandsInRoots(resolveSlashCommandRoots(options.cwd)),
    extractSlashCommandsFromMessages(options.messages),
  );
}
