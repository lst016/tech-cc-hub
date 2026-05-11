import { ipcMain } from "electron";
import { GitWorkbenchService } from "./service.js";
import type { GitCommitDetailRequest, GitDiffRequest, GitResult, GitWorkbenchSnapshot } from "./types.js";

export type GitWorkbenchIpcChannel =
  | "git:snapshot"
  | "git:diff"
  | "git:commitDetail"
  | "git:stage"
  | "git:unstage"
  | "git:commit"
  | "git:generateCommitMessageFast"
  | "git:generateCommitMessage"
  | "git:pull"
  | "git:push"
  | "git:createBranch"
  | "git:checkoutBranch"
  | "git:stashSave"
  | "git:stashApply"
  | "git:stashDrop";

const CHANNELS: GitWorkbenchIpcChannel[] = [
  "git:snapshot",
  "git:diff",
  "git:commitDetail",
  "git:stage",
  "git:unstage",
  "git:commit",
  "git:generateCommitMessageFast",
  "git:generateCommitMessage",
  "git:pull",
  "git:push",
  "git:createBranch",
  "git:checkoutBranch",
  "git:stashSave",
  "git:stashApply",
  "git:stashDrop",
];

const service = new GitWorkbenchService();
let registered = false;

export function registerGitWorkbenchIpcHandlers(): void {
  if (registered) return;
  registered = true;

  for (const channel of CHANNELS) {
    ipcMain.handle(channel, async (_event, ...args: unknown[]) => {
      try {
        return await handleGitWorkbenchInvoke(channel, ...args);
      } catch (error) {
        return invalidResult(error instanceof Error ? error.message : String(error));
      }
    });
  }
}

export async function handleGitWorkbenchInvoke(channel: string, ...args: unknown[]): Promise<unknown> {
  try {
    const payload = readObject(args[0]);

    switch (channel) {
      case "git:snapshot":
        return service.getSnapshot(readRequiredString(payload, "cwd"));
      case "git:diff":
        return service.getDiff({
          cwd: readRequiredString(payload, "cwd"),
          path: readRequiredString(payload, "path"),
          staged: Boolean(payload.staged),
        } satisfies GitDiffRequest);
      case "git:commitDetail":
        return service.getCommitDetail({
          cwd: readRequiredString(payload, "cwd"),
          hash: readRequiredString(payload, "hash"),
        } satisfies GitCommitDetailRequest);
      case "git:stage":
        return service.stageFiles(readRequiredString(payload, "cwd"), readStringArray(payload, "paths"));
      case "git:unstage":
        return service.unstageFiles(readRequiredString(payload, "cwd"), readStringArray(payload, "paths"));
      case "git:commit":
        return service.commit(readRequiredString(payload, "cwd"), {
          message: readRequiredString(payload, "message"),
          body: readOptionalString(payload, "body"),
        });
      case "git:generateCommitMessageFast":
        return service.generateFallbackCommitMessage(readRequiredString(payload, "cwd"));
      case "git:generateCommitMessage":
        return service.generateCommitMessage(
          readRequiredString(payload, "cwd"),
          readOptionalString(payload, "language"),
        );
      case "git:pull":
        return service.pull(readRequiredString(payload, "cwd"));
      case "git:push":
        return service.push(readRequiredString(payload, "cwd"));
      case "git:createBranch":
        return service.createBranch(readRequiredString(payload, "cwd"), readRequiredString(payload, "name"), Boolean(payload.checkout));
      case "git:checkoutBranch":
        return service.checkoutBranch(readRequiredString(payload, "cwd"), readRequiredString(payload, "name"));
      case "git:stashSave":
        return service.stashSave(readRequiredString(payload, "cwd"), readOptionalString(payload, "message"));
      case "git:stashApply":
        return service.stashApply(readRequiredString(payload, "cwd"), readRequiredString(payload, "ref"));
      case "git:stashDrop":
        return service.stashDrop(readRequiredString(payload, "cwd"), readRequiredString(payload, "ref"));
      default:
        return invalidResult(`Unsupported Git channel: ${channel}`);
    }
  } catch (error) {
    return invalidResult(error instanceof Error ? error.message : String(error));
  }
}

function readObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function readRequiredString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing Git IPC field: ${key}`);
  }
  return value.trim();
}

function readOptionalString(payload: Record<string, unknown>, key: string): string | undefined {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readStringArray(payload: Record<string, unknown>, key: string): string[] {
  const value = payload[key];
  if (!Array.isArray(value)) {
    throw new Error(`Missing Git IPC array field: ${key}`);
  }
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim());
}

function invalidResult(message: string): GitResult<GitWorkbenchSnapshot> {
  return {
    success: false,
    error: {
      code: "operation_failed",
      message,
    },
  };
}
