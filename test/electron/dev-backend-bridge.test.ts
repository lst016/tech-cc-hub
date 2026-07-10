import { spawn, type ChildProcessByStdio } from "node:child_process";
import { once } from "node:events";
import { get } from "node:http";
import type { Readable } from "node:stream";
import test from "node:test";
import assert from "node:assert/strict";

import { startDevBackendBridge } from "../../src/electron/dev-backend-bridge.js";

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForBridgeHealth(port: number): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const healthy = await new Promise<boolean>((resolve) => {
      const request = get(`http://127.0.0.1:${port}/health`, (response) => {
        response.resume();
        resolve(response.statusCode === 200);
      });
      request.setTimeout(250, () => {
        request.destroy();
        resolve(false);
      });
      request.on("error", () => resolve(false));
    });
    if (healthy) return;
    await wait(50);
  }
  throw new Error(`Dev bridge did not become healthy on port ${port}.`);
}

async function startPortOwnerProcess(): Promise<{ child: ChildProcessByStdio<null, Readable, Readable>; port: number }> {
  const child = spawn(process.execPath, [
    "-e",
    [
      "const http = require('node:http');",
      "const server = http.createServer((_request, response) => { response.end('occupied'); });",
      "server.listen(0, '127.0.0.1', () => { console.log(server.address().port); });",
      "setInterval(() => {}, 1000);",
    ].join(" "),
  ], {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });

  const port = await new Promise<number>((resolve, reject) => {
    let settled = false;
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
      const match = stdout.match(/(\d+)/);
      if (!match || settled) return;
      settled = true;
      resolve(Number.parseInt(match[1], 10));
    });
    child.once("exit", (code, signal) => {
      if (settled) return;
      settled = true;
      reject(new Error(`Port owner exited before reporting a port: code=${code ?? "null"} signal=${signal ?? "null"} stderr=${stderr.trim()}`));
    });
    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    });
  });

  return { child, port };
}

test("dev backend bridge kills the process occupying its port and retries startup", { skip: process.platform !== "win32" }, async () => {
  const { child, port } = await startPortOwnerProcess();
  const warnings: string[] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    warnings.push(args.map(String).join(" "));
  };

  const handle = startDevBackendBridge({
    port,
    platform: "test",
    handlers: {},
    subscribeServerEvents: () => () => {},
    subscribeBrowserEvents: () => () => {},
  });

  try {
    await waitForBridgeHealth(port);
    if (child.exitCode === null && child.signalCode === null) {
      await Promise.race([once(child, "exit"), wait(1000)]);
    }
    assert.notEqual(child.exitCode, null);
    assert.match(warnings.join("\n"), /killed and retrying startup/);
  } finally {
    console.warn = originalWarn;
    handle.stop();
    if (child.exitCode === null && child.signalCode === null) {
      child.kill();
      await Promise.race([once(child, "exit"), wait(1000)]);
    }
  }
});
