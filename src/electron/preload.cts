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
    getGlobalConfig: () =>
        ipcInvoke("get-global-config"),
    saveGlobalConfig: (config: any) =>
        ipcInvoke("save-global-config", config),
    getAgentRuleDocuments: () =>
        ipcInvoke("get-agent-rule-documents"),
    saveUserAgentRuleDocument: (markdown: string) =>
        ipcInvoke("save-user-agent-rule-document", markdown),
    getSkillInventory: () =>
        ipcInvoke("get-skill-inventory"),
    saveSkillInventory: (inventory: any) =>
        ipcInvoke("save-skill-inventory", inventory),
    syncSkillSources: (request: any) =>
        ipcInvoke("sync-skill-sources", request),
    checkApiConfig: () =>
        ipcInvoke("check-api-config"),
    debugSaveTraceSnapshot: (snapshot: any) =>
        ipcInvoke("debug-save-trace-snapshot", snapshot),
    preprocessImageAttachments: (payload: any) =>
        ipcInvoke("preprocess-image-attachments", payload),
    readPreviewFile: (payload: any) =>
        electron.ipcRenderer.invoke("preview-read-file", payload),
    listPreviewDirectory: (payload: any) =>
        electron.ipcRenderer.invoke("preview-list-directory", payload),
    getPreviewImageBase64: (payload: any) =>
        electron.ipcRenderer.invoke("preview-get-image-base64", payload),
    getPreviewFileMetadata: (payload: any) =>
        electron.ipcRenderer.invoke("preview-get-file-metadata", payload),
    writePreviewFile: (payload: any) =>
        electron.ipcRenderer.invoke("preview-write-file", payload),
    removePreviewEntry: (payload: any) =>
        electron.ipcRenderer.invoke("preview-remove-entry", payload),
    renamePreviewEntry: (payload: any) =>
        electron.ipcRenderer.invoke("preview-rename-entry", payload),
    openPreviewFile: (payload: any) =>
        electron.ipcRenderer.invoke("preview-open-file", payload),
    showPreviewItemInFolder: (payload: any) =>
        electron.ipcRenderer.invoke("preview-show-item-in-folder", payload),
    openPreviewDirectoryDialog: (payload: any) =>
        electron.ipcRenderer.invoke("preview-open-dialog", payload),
    openBrowserWorkbench: (url: string, sessionId?: string) =>
        ipcInvoke("browser-open", url, sessionId),
    closeBrowserWorkbench: (sessionId?: string) =>
        ipcInvoke("browser-close", sessionId),
    setBrowserWorkbenchBounds: (bounds: any, sessionId?: string) =>
        ipcInvoke("browser-set-bounds", bounds, sessionId),
    reloadBrowserWorkbench: (sessionId?: string) =>
        ipcInvoke("browser-reload", sessionId),
    goBackBrowserWorkbench: (sessionId?: string) =>
        ipcInvoke("browser-back", sessionId),
    goForwardBrowserWorkbench: (sessionId?: string) =>
        ipcInvoke("browser-forward", sessionId),
    getBrowserWorkbenchState: (sessionId?: string) =>
        ipcInvoke("browser-state", sessionId),
    getBrowserWorkbenchConsoleLogs: (limit?: number, sessionId?: string) =>
        ipcInvoke("browser-console-logs", limit, sessionId),
    captureBrowserWorkbenchVisible: (sessionId?: string) =>
        ipcInvoke("browser-capture-visible", sessionId),
    inspectBrowserWorkbenchAtPoint: (point: any, sessionId?: string) =>
        ipcInvoke("browser-inspect-at-point", point, sessionId),
    clearBrowserWorkbenchAnnotations: (sessionId?: string) =>
        ipcInvoke("browser-clear-annotations", sessionId),
    setBrowserWorkbenchAnnotationMode: (enabled: boolean, sessionId?: string) =>
        ipcInvoke("browser-annotation-mode", enabled, sessionId),
    openBrowserWorkbenchDevTools: (sessionId?: string) =>
        ipcInvoke("browser-open-devtools", sessionId),
    closeBrowserWorkbenchDevTools: (sessionId?: string) =>
        ipcInvoke("browser-close-devtools", sessionId),
    isBrowserWorkbenchDevToolsOpen: (sessionId?: string) =>
        ipcInvoke("browser-is-devtools-open", sessionId),
    onBrowserWorkbenchEvent: (callback: (event: any) => void) => {
        const cb = (_: Electron.IpcRendererEvent, payload: string) => {
            try {
                callback(JSON.parse(payload));
            } catch (error) {
                console.error("Failed to parse browser event:", error);
            }
        };
        electron.ipcRenderer.on("browser-event", cb);
        return () => electron.ipcRenderer.off("browser-event", cb);
    },
} satisfies Window['electron'])

function ipcInvoke<Key extends keyof EventPayloadMapping>(key: Key, ...args: any[]): Promise<EventPayloadMapping[Key]> {
    return electron.ipcRenderer.invoke(key, ...args);
}

function ipcOn<Key extends keyof EventPayloadMapping>(key: Key, callback: (payload: EventPayloadMapping[Key]) => void) {
    const cb = (_: Electron.IpcRendererEvent, payload: any) => callback(payload)
    electron.ipcRenderer.on(key, cb);
    return () => electron.ipcRenderer.off(key, cb)
}
