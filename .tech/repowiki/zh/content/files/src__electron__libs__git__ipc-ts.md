# src/electron/libs/git/ipc.ts

> 模块：`git-workbench` · 语言：`typescript` · 行数：148

## 文件职责

注册Electron IPC处理器，将service方法映射到git:* channel

## 关键符号

- `GitWorkbenchIpcChannel@0 - 所有Git IPC channel的联合类型`
- `CHANNELS@0 - 所有注册的channel数组`
- `registerGitWorkbenchIpcHandlers@0 - 遍历CHANNELS为每个channel注册ipcMain.handle处理器`
- `handleGitWorkbenchInvoke@0 - 解析payload参数，根据channel调用对应service方法`

## 依赖输入

- `electron`
- `./service.js`
- `./types.js`

## 对外暴露

- `GitWorkbenchIpcChannel`
- `registerGitWorkbenchIpcHandlers`
- `handleGitWorkbenchInvoke`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
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
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
... (truncated)
```
