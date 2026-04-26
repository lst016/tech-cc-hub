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
    generateSessionTitle: (userInput: string | null) => 
        ipcInvoke("generate-session-title", userInput),
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
    openBrowserWorkbench: (url: string) =>
        ipcInvoke("browser-open", url),
    closeBrowserWorkbench: () =>
        ipcInvoke("browser-close"),
    setBrowserWorkbenchBounds: (bounds: any) =>
        ipcInvoke("browser-set-bounds", bounds),
    reloadBrowserWorkbench: () =>
        ipcInvoke("browser-reload"),
    goBackBrowserWorkbench: () =>
        ipcInvoke("browser-back"),
    goForwardBrowserWorkbench: () =>
        ipcInvoke("browser-forward"),
    getBrowserWorkbenchState: () =>
        ipcInvoke("browser-state"),
    getBrowserWorkbenchConsoleLogs: (limit?: number) =>
        ipcInvoke("browser-console-logs", limit),
    captureBrowserWorkbenchVisible: () =>
        ipcInvoke("browser-capture-visible"),
    inspectBrowserWorkbenchAtPoint: (point: any) =>
        ipcInvoke("browser-inspect-at-point", point),
    setBrowserWorkbenchAnnotationMode: (enabled: boolean) =>
        ipcInvoke("browser-annotation-mode", enabled),
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
