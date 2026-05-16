# src/electron/libs/knowledge/repowiki/engine.ts

> 模块：`knowledge-engine` · 语言：`typescript` · 行数：166

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `findRepoRoot@32`
- `pythonExecutable@42`
- `parseRunnerJson@46`
- `runVendoredRepoWiki@58`
- `generateRepoWiki@117`
- `candidates@34`
- `lines@48`
- `repoRoot@60`
- `scriptPath@61`
- `repowikiSrc@62`
- `cachePath@63`
- `maxFileSize@64`
- `args@65`
- `child@81`
- `text@95`
- `stdoutText@100`
- `stderrText@101`
- `result@121`
- `generatedFiles@123`
- `pageCount@124`
- `scannedFiles@125`
- `totalLines@126`
- `RepoWikiGenerationResult@8`
- `RepoWikiRunnerResult@16`

## 依赖输入

- `child_process`
- `path`
- `fs`
- `../knowledge-types.js`
- `../knowledge-paths.js`
- `./types.js`

## 对外暴露

- `RepoWikiGenerationResult`
- `generateRepoWiki`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import { spawn } from "child_process";
import { delimiter } from "path";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import type { WikiModelSettings } from "../knowledge-types.js";
import type { KnowledgeWorkspacePaths } from "../knowledge-paths.js";
import type { RepoWikiSkippedFile } from "./types.js";

export type RepoWikiGenerationResult = {
  generatedFiles: string[];
  skipped: RepoWikiSkippedFile[];
  pageCount: number;
  scannedFiles: number;
  totalLines: number;
};

type RepoWikiRunnerResult = {
  success?: boolean;
  engine?: string;
  projectName?: string;
  scannedFiles?: number;
  totalLines?: number;
  pageCount?: number;
  generatedFiles?: string[];
  tokens?: {
    input?: number;
    output?: number;
    cost?: number;
  };
  error?: string;
};

function findRepoRoot(): string {
  const candidates = [process.cwd(), resolve(process.cwd(), ".."), resolve(process.cwd(), "../..")];
  for (const candidate of candidates) {
    if (existsSync(join(candidate, "third_party", "repowiki", "src", "repowiki"))) {
      return candidate;
    }
  }
  throw new Error("找不到 vendored RepoWiki：third_party/repowiki。");
}

function pythonExecutable(): string {
  return process.env.TECH_CC_HUB_PYTHON || process.env.PYTHON || (process.platform === "win32" ? "python" : "python3");
}

function parseRunnerJson(stdout: string): RepoWikiRunnerResult {
  const lines = stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (const line of lines.reverse()) {
    try {
      return JSON.parse(line) as RepoWikiRunnerResult;
    } catch {
      // Some Python tooling writes non-JSON informational lines. Keep looking.
    }
  }
  throw new Error(`RepoWiki runner 没有返回 JSON：${stdout.slice(0, 400)}`);
}

async function runVendoredRepoWiki(paths: KnowledgeWorkspacePaths, wiki: WikiModelSettings): Promise<RepoWikiRunnerResult> {
  const repoRoot = findRepoRoot();
  const scriptPath = join(repoRoot, "scripts", "knowledge", "run-repowiki.py");
  const repowikiSrc = join(repoRoot, "third_party", "repowiki", "src");
  const cachePath = join(paths.appDataWorkspaceRoot, "repowiki-cache.sqlite");
  const maxFileSize = Math.max(64 * 1024, Math.min(400 * 1024, Math.floor((wiki.maxInputTokens || 32_000) * 8)));
  const args = [
    scriptPath,
    "--workspace", paths.workspaceRoot,
    "--output", paths.repowikiContentDir,
    "--cache", cachePath,
    "--model", wiki.model,
    "--api-key", wiki.apiKey,
    "--api-base", wiki.baseURL,
    "--language", "zh",
    "--concurrency", wiki.costTier === "free" ? "1" : "3",
    "--max-files", process.env.REPOWIKI_MAX_FILES || "0",
    "--max-file-size", String(maxFileSize),
    "--file-page-limit", process.env.REPOWIKI_FILE_PAGE_LIMIT || process.env.TECH_CC_HUB_REPOWIKI_FILE_PAGE_LIMIT || "0",
  ];

  return await new Promise((resolvePromise, reject) => {
    const child = spawn(pythonExecutable(), args, {
      cwd: repoRoot,
      env: {
        ...process.env,
        PYTHONPATH: `${repowikiSrc}${process.env.PYTHONPATH ? `${delimiter}${process.env.PYTHONPATH}` : ""}`,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => {
      stderr.push(chunk);
      const text = chunk.toString("utf8").trim();
      if (text) console.log(`[repowiki] ${text}`);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      const stdoutText = Buffer.concat(stdout).toString("utf8");
      const stderrText = Buffer.concat(stderr).toString("utf8");
      let result: RepoWikiRunnerResult;
      try {
        result = parseRunnerJson(stdoutText);
      } catch (error) {
        reject(error);
        return;
      }
      if (code !== 0 || result.success === false) {
        reject(new Error(result.error || stderrText || `RepoWiki runner exited with code ${code}`));
        return;
      }
      resolvePromise(result);
    });
  });
}

export async function generateRepoWiki(paths: KnowledgeWorkspacePaths, wiki: WikiModelSettings): Promise<RepoWikiGenerationResul
... (truncated)
```
