import { spawn, type ChildProcessByStdio } from "node:child_process";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import type { Readable } from "node:stream";
import test from "node:test";
import assert from "node:assert/strict";

import { killWindowsPortListeners } from "../../src/electron/libs/local-port-guard.js";

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

test("local port guard kills Windows listener processes", { skip: process.platform !== "win32" }, async () => {
  const { child, port } = await startPortOwnerProcess();

  try {
    const killedPids = await killWindowsPortListeners(port);
    assert.ok(killedPids.includes(child.pid ?? -1));

    if (child.exitCode === null && child.signalCode === null) {
      await Promise.race([once(child, "exit"), wait(1000)]);
    }
    assert.notEqual(child.exitCode, null);
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill();
      await Promise.race([once(child, "exit"), wait(1000)]);
    }
  }
});

test("local model proxies retry startup with the shared Windows port guard", () => {
  const codexProxySource = readFileSync("src/electron/libs/codex/codex-anthropic-proxy.ts", "utf8");
  const anthropicProxySource = readFileSync("src/electron/libs/anthropic/anthropic-compat-proxy.ts", "utf8");

  assert.match(codexProxySource, /listenWithWindowsPortOwnerKill/);
  assert.match(codexProxySource, /label:\s*"codex-proxy"/);
  assert.match(anthropicProxySource, /listenWithWindowsPortOwnerKill/);
  assert.match(anthropicProxySource, /label:\s*"anthropic-compat-proxy"/);
});
