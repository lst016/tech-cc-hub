import {
    app,
    BrowserWindow,
    dialog,
    globalShortcut,
    IpcMainEvent,
    IpcMainInvokeEvent,
    ipcMain,
    Menu,
} from "electron"
import { execSync } from "child_process";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { ipcMainHandle, isDev, DEV_PORT } from "./util.js";
import { getPreloadPath, getUIPath, getIconPath } from "./pathResolver.js";
import { getStaticData, pollResources, stopPolling } from "./test.js";
import { handleClientEvent, sessions, cleanupAllSessions } from "./ipc-handlers.js";
import { generateSessionTitle } from "./libs/util.js";
import {
  loadApiConfigSettings,
  type ApiConfigSettings,
  saveApiConfigSettings,
  loadGlobalRuntimeConfig,
  saveGlobalRuntimeConfig,
  loadSkillInventory,
  saveSkillInventory,
  type SkillSyncRequest,
} from "./libs/config-store.js";
import { startSkillSyncScheduler, stopSkillSyncScheduler, syncSkillSources } from "./libs/skill-registry-sync.js";
import { ensureSystemWorkspace } from "./libs/system-workspace.js";
import { getCurrentApiConfig } from "./libs/claude-settings.js";
import { preprocessImageAttachments } from "./libs/image-preprocessor.js";
import type { ClientEvent, PromptAttachment } from "./types.js";
import "./libs/claude-settings.js";

let cleanupComplete = false;
let mainWindow: BrowserWindow | null = null;

async function sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadRenderer(window: BrowserWindow): Promise<void> {
    if (!isDev()) {
        await window.loadFile(getUIPath());
        return;
    }

    const devUrl = `http://localhost:${DEV_PORT}`;
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= 30; attempt += 1) {
        try {
            await window.loadURL(devUrl);
            return;
        } catch (error) {
            lastError = error;
            if (attempt === 30) break;
            await sleep(300);
        }
    }

    throw lastError instanceof Error
        ? lastError
        : new Error(`无法连接开发服务器：${devUrl}`);
}

async function scheduleDevAutostart(): Promise<void> {
    if (!isDev()) return;

    const prompt = process.env.AGENT_COWORK_DEV_AUTOSTART_PROMPT?.trim();
    if (!prompt) return;
    const continuePrompt = process.env.AGENT_COWORK_DEV_CONTINUE_PROMPT?.trim();

    const cwd = process.env.AGENT_COWORK_DEV_AUTOSTART_CWD?.trim() || undefined;

    setTimeout(async () => {
        try {
            const title = await generateSessionTitle(prompt);
            void handleClientEvent({
                type: "session.start",
                payload: { title, prompt, cwd, allowedTools: "Read,Edit,Bash" }
            });

            if (!continuePrompt) return;

            const deadline = Date.now() + 60_000;
            const timer = setInterval(() => {
                if (!sessions) return;
                const latest = sessions
                    .listSessions()
                    .find((session) => session.lastPrompt === prompt);

                if (!latest) return;

                if (latest.status === "completed" && latest.claudeSessionId) {
                    clearInterval(timer);
                    void handleClientEvent({
                        type: "session.continue",
                        payload: { sessionId: latest.id, prompt: continuePrompt }
                    });
                    return;
                }

                if (latest.status === "error" || Date.now() > deadline) {
                    clearInterval(timer);
                    console.error("[dev-autostart] Continue prompt skipped because the initial session did not complete in time.");
                }
            }, 1500);
        } catch (error) {
            console.error("[dev-autostart] Failed to bootstrap session:", error);
        }
    }, 1800);
}

function killViteDevServer(): void {
    if (!isDev()) return;
    try {
        if (process.platform === 'win32') {
            execSync(`for /f "tokens=5" %a in ('netstat -ano ^| findstr :${DEV_PORT}') do taskkill /PID %a /F`, { stdio: 'ignore', shell: 'cmd.exe' });
        } else {
            execSync(`lsof -ti:${DEV_PORT} | xargs kill -9 2>/dev/null || true`, { stdio: 'ignore' });
        }
    } catch {
        // Process may already be dead
    }
}

function cleanup(): void {
    if (cleanupComplete) return;
    cleanupComplete = true;

    globalShortcut.unregisterAll();
    stopPolling();
    cleanupAllSessions();
    stopSkillSyncScheduler();
    killViteDevServer();
}

function handleSignal(): void {
    cleanup();
    app.quit();
}

function registerReloadShortcuts(): void {
    if (!mainWindow) {
        return;
    }

    const reloadWindow = () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.reload();
        }
    };

    const reloadWindowIgnoringCache = () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.reloadIgnoringCache();
        }
    };

    const shortcuts = [
        { accelerator: "CommandOrControl+R", handler: reloadWindow },
        { accelerator: "F5", handler: reloadWindow },
        { accelerator: "CommandOrControl+Shift+R", handler: reloadWindowIgnoringCache },
    ];

    for (const shortcut of shortcuts) {
        try {
            const registered = globalShortcut.register(shortcut.accelerator, shortcut.handler);
            if (!registered) {
                console.warn(`[main] Failed to register shortcut: ${shortcut.accelerator}`);
            }
        } catch (error) {
            console.warn(`[main] Failed to bind shortcut ${shortcut.accelerator}:`, error);
        }
    }
}

function readPromptAttachmentPayload(attachments?: unknown[]): PromptAttachment[] {
    return Array.isArray(attachments) ? (attachments as PromptAttachment[]) : [];
}

// Initialize everything when app is ready
app.on("ready", async () => {
    Menu.setApplicationMenu(null);
    // Setup event handlers
    app.on("before-quit", cleanup);
    app.on("will-quit", cleanup);
    app.on("window-all-closed", () => {
        cleanup();
        app.quit();
    });

    process.on("SIGTERM", handleSignal);
    process.on("SIGINT", handleSignal);
    process.on("SIGHUP", handleSignal);

    // Create main window
    mainWindow = new BrowserWindow({
        width: 1480,
        height: 900,
        minWidth: 1180,
        minHeight: 600,
        title: "tech-cc-hub",
        webPreferences: {
            preload: getPreloadPath(),
        },
        icon: getIconPath(),
        titleBarStyle: "hiddenInset",
        backgroundColor: "#FAF9F6",
        trafficLightPosition: { x: 15, y: 18 }
    });

    try {
        await loadRenderer(mainWindow);
    } catch (error) {
        console.error("[main] Failed to load renderer:", error);
        dialog.showErrorBox(
            "桌面端启动失败",
            error instanceof Error ? error.message : String(error)
        );
        cleanup();
        app.quit();
        return;
    }

    globalShortcut.register('CommandOrControl+Q', () => {
        cleanup();
        app.quit();
    });
    registerReloadShortcuts();

    pollResources(mainWindow);
    void scheduleDevAutostart();
    startSkillSyncScheduler();

    ipcMainHandle("getStaticData", () => {
        return getStaticData();
    });

    // Handle client events
    ipcMain.on("client-event", (_: IpcMainEvent, event: ClientEvent) => {
        void handleClientEvent(event);
    });

    // Handle session title generation
    ipcMainHandle("generate-session-title", async (_: IpcMainInvokeEvent, userInput: string | null) => {
        return await generateSessionTitle(userInput);
    });

    // Handle recent cwds request
    ipcMainHandle("get-recent-cwds", (_: IpcMainInvokeEvent, limit?: number) => {
        const boundedLimit = limit ? Math.min(Math.max(limit, 1), 20) : 8;
        return sessions.listRecentCwds(boundedLimit);
    });

    // Handle directory selection
    ipcMainHandle("select-directory", async () => {
        const result = await dialog.showOpenDialog(mainWindow!, {
            properties: ['openDirectory']
        });

        if (result.canceled) {
            return null;
        }

        return result.filePaths[0];
    });

    ipcMainHandle("get-system-workspace", () => {
        return ensureSystemWorkspace();
    });

    // Handle API config
    ipcMainHandle("get-api-config", () => {
        return loadApiConfigSettings();
    });

    ipcMainHandle("check-api-config", () => {
        const config = getCurrentApiConfig();
        return { hasConfig: config !== null, config };
    });

    ipcMainHandle("save-api-config", (_: IpcMainInvokeEvent, config: unknown) => {
        try {
            saveApiConfigSettings(config as ApiConfigSettings);
            return { success: true };
        } catch (error) {
            return { 
                success: false, 
                error: error instanceof Error ? error.message : String(error) 
            };
        }
    });

    ipcMainHandle("get-global-config", () => {
        return loadGlobalRuntimeConfig();
    });

    ipcMainHandle("save-global-config", (_: IpcMainInvokeEvent, config: unknown) => {
        try {
            saveGlobalRuntimeConfig(config as Record<string, unknown>);
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    });

    ipcMainHandle("get-skill-inventory", () => {
        return loadSkillInventory();
    });

    ipcMainHandle("save-skill-inventory", (_: IpcMainInvokeEvent, inventory: unknown) => {
        try {
            saveSkillInventory(inventory);
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    });

    ipcMainHandle("sync-skill-sources", async (_: IpcMainInvokeEvent, request: SkillSyncRequest) => {
        try {
            return await syncSkillSources(request);
        } catch (error) {
            console.error("[main] Skill sync failed:", error);
            return { results: [] };
        }
    });

    ipcMainHandle("debug-save-trace-snapshot", (_: IpcMainInvokeEvent, snapshot: unknown) => {
        try {
            const debugDir = join(app.getPath("userData"), "debug-artifacts");
            mkdirSync(debugDir, { recursive: true });
            const filePath = join(debugDir, `trace-dom-snapshot-${Date.now()}.json`);
            writeFileSync(filePath, JSON.stringify(snapshot, null, 2), "utf8");
            return { success: true, path: filePath };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    });

    ipcMainHandle("preprocess-image-attachments", async (_: IpcMainInvokeEvent, payload: { prompt?: string; selectedModel?: string; attachments?: unknown[] }) => {
        try {
            const attachments = readPromptAttachmentPayload(payload?.attachments);
            return await preprocessImageAttachments({
                config: getCurrentApiConfig(),
                prompt: payload?.prompt ?? "",
                selectedModel: payload?.selectedModel,
                attachments,
            });
        } catch (error) {
            return {
                success: false,
                attachments: readPromptAttachmentPayload(payload?.attachments),
                error: error instanceof Error ? error.message : String(error),
            };
        }
    });
})
