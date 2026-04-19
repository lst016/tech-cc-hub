import { app, BrowserWindow, ipcMain, dialog, globalShortcut, Menu } from "electron"
import { execSync } from "child_process";
import { ipcMainHandle, isDev, DEV_PORT } from "./util.js";
import { getPreloadPath, getUIPath, getIconPath } from "./pathResolver.js";
import { getStaticData, pollResources, stopPolling } from "./test.js";
import { handleClientEvent, sessions, cleanupAllSessions } from "./ipc-handlers.js";
import { generateSessionTitle } from "./libs/util.js";
import { loadApiConfigSettings, saveApiConfigSettings } from "./libs/config-store.js";
import { getCurrentApiConfig } from "./libs/claude-settings.js";
import type { ClientEvent } from "./types.js";
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
            handleClientEvent({
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
                    handleClientEvent({
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
    killViteDevServer();
}

function handleSignal(): void {
    cleanup();
    app.quit();
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

    pollResources(mainWindow);
    void scheduleDevAutostart();

    ipcMainHandle("getStaticData", () => {
        return getStaticData();
    });

    // Handle client events
    ipcMain.on("client-event", (_: any, event: ClientEvent) => {
        handleClientEvent(event);
    });

    // Handle session title generation
    ipcMainHandle("generate-session-title", async (_: any, userInput: string | null) => {
        return await generateSessionTitle(userInput);
    });

    // Handle recent cwds request
    ipcMainHandle("get-recent-cwds", (_: any, limit?: number) => {
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

    // Handle API config
    ipcMainHandle("get-api-config", () => {
        return loadApiConfigSettings();
    });

    ipcMainHandle("check-api-config", () => {
        const config = getCurrentApiConfig();
        return { hasConfig: config !== null, config };
    });

    ipcMainHandle("save-api-config", (_: any, config: any) => {
        try {
            saveApiConfigSettings(config);
            return { success: true };
        } catch (error) {
            return { 
                success: false, 
                error: error instanceof Error ? error.message : String(error) 
            };
        }
    });
})
