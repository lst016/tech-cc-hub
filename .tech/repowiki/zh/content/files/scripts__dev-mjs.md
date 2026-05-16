# scripts/dev.mjs

> 模块：`scripts` · 语言：`javascript` · 行数：66

## 文件职责

开发环境启动器，同时运行React(Vite)和Electron进程

## 关键符号

- `startTask@0 - 启动npm子任务，管理子进程生命周期和退出处理`
- `stopAll@0 - 统一终止所有子进程并退出，响应SIGINT/SIGTERM信号`

## 依赖输入

- `node:child_process`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```javascript
import { spawn } from "node:child_process";

const children = new Map();
let shuttingDown = false;

function stopAll(exitCode = 0) {
    if (shuttingDown) {
        return;
    }

    shuttingDown = true;

    for (const child of children.values()) {
        if (!child.killed) {
            child.kill();
        }
    }

    setTimeout(() => process.exit(exitCode), 500).unref();
}

function startTask(name, args) {
    const command = `npm ${args.join(" ")}`;
    const child = process.platform === "win32"
        ? spawn(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", command], {
            stdio: "inherit",
            env: process.env,
            windowsHide: true,
        })
        : spawn("npm", args, {
            stdio: "inherit",
            env: process.env,
        });

    children.set(name, child);

    child.on("exit", (code, signal) => {
        children.delete(name);

        if (shuttingDown) {
            return;
        }

        if (code === 0) {
            stopAll(0);
            return;
        }

        const reason = signal ? `signal ${signal}` : `code ${code ?? "unknown"}`;
        console.error(`[dev] ${name} exited with ${reason}`);
        stopAll(typeof code === "number" && code !== 0 ? code : 1);
    });

    child.on("error", (error) => {
        console.error(`[dev] failed to start ${name}:`, error);
        stopAll(1);
    });
}

process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));

console.log("[dev] starting React and Electron...");
startTask("react", ["run", "dev:react"]);
startTask("electron", ["run", "dev:electron"]);

```
