# src/electron/util.ts

> 模块：`electron` · 语言：`typescript` · 行数：29

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `isDev@7`
- `validateEventFrame@23`
- `DEV_PORT@4`

## 依赖输入

- `electron`
- `./pathResolver.js`
- `url`

## 对外暴露

- `DEV_PORT`
- `isDev`
- `ipcMainHandle`
- `ipcWebContentsSend`
- `validateEventFrame`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import { ipcMain, WebContents, WebFrameMain } from "electron";
import { getUIPath } from "./pathResolver.js";
import { pathToFileURL } from "url";
export const DEV_PORT = 4173;

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
    if (isDev() && new URL(frame.url).host === `localhost:${DEV_PORT}`) return;

    if (frame.url !== pathToFileURL(getUIPath()).toString()) throw new Error("Malicious event");
}

```
