# src/electron/preload.cts

> 模块：`electron` · 语言：`unknown` · 行数：206

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```unknown
import electron from "electron";

electron.contextBridge.exposeInMainWorld("electron", {
    platform: process.platform,
    subscribeStatistics: (callback) =>
        ipcOn("statistics", stats => {
            callback(stats);
        }),
    getStaticData: () => ipcInvoke("getStaticData"),

    // Claude Agent IPC APIs
    sendClientEvent: (event: any) => {
        electron.ipcRenderer.send("client-event", event);
    },
    onServerEvent: (callback: (event: any) => void) => {
        const cb = (_: Electron.IpcRendererEvent, payload: string) => {
            try {
                const event = JSON.parse(payload);
                callback(event);
            } catch (error) {
                console.error("Failed to parse server event:", error);
            }
        };
        electron.ipcRenderer.on("server-event", cb);
        return () => electron.ipcRenderer.off("server-event", cb);
    },
    generateSessionTitle: (userInput: string | null, options?: { model?: string }) =>
        ipcInvoke("generate-session-title", userInput, options),
    getRecentCwds: (limit?: number) =>
        ipcInvoke("get-recent-cwds", limit),
    getSystemWorkspace: () =>
        ipcInvoke("get-system-workspace"),
    selectDirectory: () =>
        ipcInvoke("select-directory"),
    getApiConfig: () =>
        ipcInvoke("get-api-config"),
    saveApiConfig: (config: any) =>
        ipcInvoke("save-api-config", config),
    fetchApiModels: (payload: any) =>
        ipcInvoke("fetch-api-models", payload),
    testApiConfig: (payload: any) =>
        ipcInvoke("test-api-config", payload),
    getAppUpdateStatus: () =>
        ipcInvoke("app-update-get-status"),
    checkForAppUpdates: () =>
        ipcInvoke("app-update-check"),
    downloadAppUpdate: () =>
        ipcInvoke("app-update-download"),
    installAppUpdate: () =>
        ipcInvoke("app-update-install"),
    onAppUpdateStatus: (callback: (status: any) => void) => {
        const cb = (_: Electron.IpcRendererEvent, payload: string) => {
            try {
                callback(JSON.parse(payload));
            } catch (error) {
                console.error("Failed to parse app update status:", error);
            }
        };
        electron.ipcRenderer.on("app-update-status", cb);
        return () => electron.ipcRenderer.off("app-update-status", cb);
    },
    getGlobalConfig: () =>
        ipcInvoke("get-global-config"),
    saveGlobalConfig: (config: any) =>
        ipcInvoke("save-global-config", config),
    getAgentRuleDocuments: () =>
        ipcInvoke("get-agent-rule-documents"),
    saveUserAgentRuleDocument: (markdown: string) =>
        ipcInvoke("save-user-agent-rule-document", markdown),
    invoke: (channel: string, ...args: any[]) =>
        electron.ipcRenderer.invoke(channel, ...args),
    checkApiConfig: () =>
        ipcInvoke("check-api-config"),
    debugSaveTraceSnapshot: (snapshot: any) =>
        ipcInvoke("debug-save-trace-snapshot", snapshot),
    preprocessImageAttachments: (payload: any) =>
        ipcInvoke("preprocess-image-attachments", payload),
    getGitSnapshot: (payload: any) =>
        ipcInvoke("git:snapshot", payload),
    getGitDiff: (payload: any) =>
        ipcInvoke("git:diff", payload),
    getGitCommitDetail: (payload: any) =>
        ipcInvoke("git:commitDetail", payload),
    gitStageFiles: (payload: any) =>
        ipcInvoke("git:stage", payload),
    gitUnstageFiles: (payload: any) =>
        ipcInvoke("git:unstage", payload),
    gitCommit: (payload: any) =>
        ipcInvoke("git:commit", payload),
    generateGitCommitMessageFast: (payload: any) =>
        ipcInvoke("git:generateCommitMessageFast", payload),
    generateGitCommitMessage: (payload: any) =>
        ipcInvoke("git:generateCommitMessage", payload),
    gitPull: (payload: any) =>
        ipcInvoke("git:pull", payload),
    gitPush: (payload: any) =>
        ipcInvoke("git:push", payload),
    gitCreateBranch: (payload: any) =>
        ipcInvoke("git:createBranch", payload),
    gitCheckoutBranch: (payload: any) =>
        ipcInvoke("git:checkoutBranch", payload),
    gitStashSave: (payload: any) =>
        ipcInvoke("git:stashSave", payload),
    gitSt
... (truncated)
```
