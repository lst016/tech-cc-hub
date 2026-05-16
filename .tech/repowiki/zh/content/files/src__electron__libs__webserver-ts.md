# src/electron/libs/webserver.ts

> 模块：`electron` · 语言：`typescript` · 行数：111

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `WebUIServer@21`
- `expressModule@44`
- `express@45`
- `app@46`
- `host@62`
- `message@101`
- `ExpressApp@5`
- `WebUIOptions@6`
- `WebUIState@12`

## 依赖输入

- `http`
- `crypto`
- `express`

## 对外暴露

- `WebUIOptions`
- `WebUIState`
- `WebUIServer`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import http from "http";
import crypto from "crypto";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExpressApp = any;

export type WebUIOptions = {
  port: number;
  jwtSecret?: string;
  allowLan: boolean;
};

export type WebUIState = {
  running: boolean;
  port: number;
  allowLan: boolean;
  jwtSecret: string;
  sessionCount: number;
  startedAt?: number;
};

export class WebUIServer {
  private state: WebUIState;
  private server: http.Server | null = null;
  private app: unknown = null;
  private wssClients = new Set<unknown>();

  constructor(options: WebUIOptions) {
    this.state = {
      running: false,
      port: options.port,
      allowLan: options.allowLan,
      jwtSecret: options.jwtSecret ?? crypto.randomBytes(32).toString("hex"),
      sessionCount: 0,
    };
  }

  async start(): Promise<WebUIState> {
    if (this.server) return this.state;

    return await new Promise((resolve, reject) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
        const expressModule = require("express");
        const express = expressModule as unknown as ExpressApp & { json: () => ExpressApp };
        const app = express();
        this.app = app;
        app.use(express.json());

        app.get("/health", (_req: unknown, res: { json: (data: unknown) => void }) => {
          res.json({ status: "ok", ...this.state });
        });

        app.post("/api/auth/login", (req: { body?: { token?: string } }, res: { json: (data: unknown) => void; status: (code: number) => { json: (data: unknown) => void } }) => {
          const { token } = req.body as { token?: string };
          if (token === this.state.jwtSecret) {
            res.json({ success: true, token });
          } else {
            res.status(401).json({ success: false, error: "Invalid token" });
          }
        });

        const host = this.state.allowLan ? "0.0.0.0" : "127.0.0.1";
        this.server = http.createServer(app);
        this.server.listen(this.state.port, host, () => {
          this.state.running = true;
          this.state.startedAt = Date.now();
          resolve(this.state);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async stop(): Promise<void> {
    return await new Promise((resolve) => {
      if (!this.server) {
        resolve();
        return;
      }

      for (const client of this.wssClients) {
        try { (client as { close: () => void }).close(); } catch { /* ignore */ }
      }
      this.wssClients.clear();

      this.server.close(() => {
        this.server = null;
        this.state.running = false;
        resolve();
      });
    });
  }

  getState(): WebUIState {
    return { ...this.state };
  }

  broadcast(type: string, payload: unknown): void {
    const message = JSON.stringify({ type, payload });
    for (const client of this.wssClients) {
      try { (client as { send: (m: string) => void }).send(message); } catch { /* ignore */ }
    }
  }

  destroy(): void {
    void this.stop();
  }
}

```
