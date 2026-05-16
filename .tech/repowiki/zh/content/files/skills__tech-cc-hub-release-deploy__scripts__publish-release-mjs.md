# skills/tech-cc-hub-release-deploy/scripts/publish-release.mjs

> 模块：`skills` · 语言：`javascript` · 行数：390

## 文件职责

这是项目入口文件或运行入口，优先阅读它可以理解启动链路和主流程。

## 关键符号

- `log@29`
- `fail@33`
- `git@38`
- `gitBuffer@45`
- `runGit@52`
- `writeGitOutput@65`
- `isGitDiscoveryFailure@70`
- `getCredentialToken@74`
- `request@86`
- `parseNameStatus@123`
- `readTreeMode@138`
- `readCommitMessage@145`
- `readCommitIdentity@152`
- `readSingleParent@174`
- `readCommitTree@182`
- `assertCleanApiTree@186`
- `syncOriginMain@193`
- `updateReleaseNotes@198`
- `createApiTreeForCommit@212`
- `publishViaApi@250`
- `main@353`
- `OWNER@7`
- `REPO@9`
- `DEFAULT_BRANCH@10`
- `args@11`
- `flags@13`
- `values@14`
- `arg@16`
- `tag@22`
- `notesPath@24`
- `retag@25`
- `deleteRelease@26`
- `apiOnly@27`
- `notesOnly@28`
- `result@54`
- `credential@78`
- `passwordLine@83`
- `data@88`
- `req@90`
- `chunks@102`

## 依赖输入

- `node:child_process`
- `node:fs`
- `node:https`
- `node:path`
- `node:process`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```javascript
#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import https from "node:https";
import path from "node:path";
import process from "node:process";

const OWNER = "lst016";
const REPO = "tech-cc-hub";
const DEFAULT_BRANCH = "main";

const args = process.argv.slice(2);
const flags = new Set(args.filter((arg) => arg.startsWith("--")));
const values = new Map();
for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg.startsWith("--") && args[index + 1] && !args[index + 1].startsWith("--")) {
    values.set(arg, args[index + 1]);
    index += 1;
  }
}

const tag = values.get("--tag") ?? "";
const notesPath = values.get("--notes") ?? "";
const retag = flags.has("--retag");
const deleteRelease = flags.has("--delete-release");
const apiOnly = flags.has("--api-only");
const notesOnly = flags.has("--notes-only");

function log(message) {
  console.log(`[tech-cc-hub-release] ${message}`);
}

function fail(message) {
  console.error(`[tech-cc-hub-release] ${message}`);
  process.exit(1);
}

function git(argsForGit, options = {}) {
  return execFileSync("git", argsForGit, {
    encoding: options.encoding ?? "utf8",
    maxBuffer: 128 * 1024 * 1024,
  });
}

function gitBuffer(argsForGit) {
  return execFileSync("git", argsForGit, {
    encoding: "buffer",
    maxBuffer: 128 * 1024 * 1024,
  });
}

function runGit(argsForGit) {
  const result = spawnSync("git", argsForGit, {
    encoding: "utf8",
    shell: false,
  });
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function writeGitOutput(result) {
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
}

function isGitDiscoveryFailure(result) {
  return result.stderr.includes("not a git repository");
}

function getCredentialToken() {
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN;
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;

  const credential = execFileSync("git", ["credential", "fill"], {
    input: "protocol=https\nhost=github.com\n\n",
    encoding: "utf8",
  });
  const passwordLine = credential.split(/\r?\n/).find((line) => line.startsWith("password="));
  return passwordLine?.slice("password=".length).trim() || "";
}

function request(method, apiPath, body, token) {
  const data = body === undefined ? undefined : Buffer.from(JSON.stringify(body));
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: "api.github.com",
      path: apiPath,
      method,
      headers: {
        "Accept": "application/vnd.github+json",
        "User-Agent": "tech-cc-hub-release-deploy",
        "Authorization": `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(data ? { "Content-Type": "application/json", "Content-Length": data.length } : {}),
      },
    }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        const parsed = text ? JSON.parse(text) : null;
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(parsed);
          return;
        }
        if (res.statusCode === 404) {
          resolve({ __notFound: true, status: 404, message: parsed?.message ?? text });
          return;
        }
        reject(new Error(`${method} ${apiPath} failed ${res.statusCode}: ${parsed?.message ?? text}`));
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

function parseNameStatus(raw) {
  const parts = raw.split("\0").filter(Boolean);
  const entries = [];
  for (let index = 0; index < parts.length;) {
    const status = parts[index++];
    if (status.startsWith("R") || status.startsWith("C")) {
      entries.push({ status: "D", filePath: parts[index++] });
      entries.push({ status: "A", filePath: parts[index++] });
    } else {
      entries.push({ status, filePath: parts[index++] });
    }
  }
  return entries;
}

function readT
... (truncated)
```
