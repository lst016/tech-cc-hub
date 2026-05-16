# src/electron/test.ts

> 模块：`electron` · 语言：`typescript` · 行数：71

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `pollResources@10`
- `stopPolling@29`
- `getStaticData@36`
- `getCPUUsage@48`
- `getRamUsage@54`
- `getStorageData@58`
- `POLLING_INTERVAL@6`
- `cpuUsage@17`
- `storageData@18`
- `ramUsage@19`
- `totalStorage@38`
- `cpuModel@39`
- `totalMemoryGB@40`
- `stats@60`
- `total@61`
- `free@62`

## 依赖输入

- `os-utils`
- `fs`
- `os`
- `electron`
- `./util.js`

## 对外暴露

- `pollResources`
- `stopPolling`
- `getStaticData`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import osUtils from "os-utils";
import fs from "fs"
import os from "os"
import { BrowserWindow } from "electron";
import { ipcWebContentsSend } from "./util.js";

const POLLING_INTERVAL = 500;

let pollingIntervalId: ReturnType<typeof setInterval> | null = null;

export function pollResources(mainWindow: BrowserWindow): void {
    pollingIntervalId = setInterval(async () => {
        if (mainWindow.isDestroyed()) {
            stopPolling();
            return;
        }
        const cpuUsage = await getCPUUsage();
        const storageData = getStorageData();
        const ramUsage = getRamUsage();

        if (mainWindow.isDestroyed()) {
            stopPolling();
            return;
        }

        ipcWebContentsSend("statistics", mainWindow.webContents, { cpuUsage, ramUsage, storageData: storageData.usage });
    }, POLLING_INTERVAL);
}

export function stopPolling(): void {
    if (pollingIntervalId) {
        clearInterval(pollingIntervalId);
        pollingIntervalId = null;
    }
}

export function getStaticData() {
    const totalStorage = getStorageData().total;
    const cpuModel = os.cpus()[0].model;
    const totalMemoryGB = Math.floor(osUtils.totalmem() / 1024);

    return {
        totalStorage,
        cpuModel,
        totalMemoryGB
    }
}

function getCPUUsage(): Promise<number> {
    return new Promise(resolve => {
        osUtils.cpuUsage(resolve);
    })
}

function getRamUsage() {
    return 1 - osUtils.freememPercentage();
}

function getStorageData() {
    const stats = fs.statfsSync(process.platform === 'win32' ? 'C://' : '/');
    const total = stats.bsize * stats.blocks;
    const free = stats.bsize * stats.bfree;

    return {
        total: Math.floor(total / 1_000_000_000),
        usage: 1 - free / total
    }
}



```
