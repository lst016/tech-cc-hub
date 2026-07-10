import { ipcMain, WebContents, WebFrameMain } from "electron";
import { getUIPath } from "./pathResolver.js";
import { pathToFileURL } from "url";
export { DEV_PORT } from "./ipc-frame-validation.js";
import { DEV_PORT, isAllowedDevFrameUrl } from "./ipc-frame-validation.js";

// Checks if you are in development mode
export function isDev(): boolean {
    return process.env.NODE_ENV == "development";
}

// Making IPC Typesafe
export function ipcMainHandle<Key extends keyof EventPayloadMapping>(key: Key, handler: (...args: any[]) => EventPayloadMapping[Key] | Promise<EventPayloadMapping[Key]>) {
    ipcMain.handle(key, (event, ...args) => {
        if (event.senderFrame) validateEventFrame(event.senderFrame);

        return handler(event, ...args)
    });
}

export function ipcWebContentsSend<Key extends keyof EventPayloadMapping>(key: Key, webContents: WebContents, payload: EventPayloadMapping[Key]) {
    webContents.send(key, payload);
}

export function validateEventFrame(frame: WebFrameMain) {
    if (isDev() && isAllowedDevFrameUrl(frame.url)) return;

    if (frame.url !== pathToFileURL(getUIPath()).toString()) throw new Error("Malicious event");
}
