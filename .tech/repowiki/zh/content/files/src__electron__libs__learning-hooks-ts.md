# src/electron/libs/learning-hooks.ts

> 模块：`electron` · 语言：`typescript` · 行数：656

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `getLearningStore@8`
- `scanForSecrets@43`
- `sub@65`
- `validateCommitMessage@84`
- `getAdaptiveThreshold@128`
- `createLearnCaptureHook@154`
- `createCorrectionDetectionHook@202`
- `createQualityGateHook@241`
- `createCorrectionTrackingHook@301`
- `createSecretScanHook@337`
- `createGitBlastRadiusHook@384`
- `createCommitValidateHook@423`
- `createToolCallBudgetHook@457`
- `createDriftDetectorHook@522`
- `createReadBeforeWriteHook@601`
- `getLearningStoreForIPC@645`
- `disposeLearningStore@649`
- `userDataPath@12`
- `dbPath@13`
- `SECRET_PATTERNS@22`
- `SECRET_ALLOWLIST@37`
- `m@47`
- `snippet@49`
- `matchIndex@50`
- `line@51`
- `lineEndIndex@52`
- `wholeLine@53`
- `GIT_PREFIX@64`
- `GIT_BLOCK@68`
- `COMMIT_TYPES@81`
- `COMMIT_PATTERN@82`
- `MAX_COMMIT_SUMMARY@83`
- `shortFlag@86`
- `longFlag@87`
- `raw@88`
- `firstLine@91`
- `summary@98`
- `CORRECTION_PATTERNS@106`
- `LEARN_TRIGGER_PATTERNS@115`
- `LEARN_REGEX@125`

## 依赖输入

- `./learning-store.js`
- `electron`
- `path`
- `fs`
- `@anthropic-ai/claude-agent-sdk`

## 对外暴露

- `createLearnCaptureHook`
- `createCorrectionDetectionHook`
- `createQualityGateHook`
- `createCorrectionTrackingHook`
- `createSecretScanHook`
- `createGitBlastRadiusHook`
- `createCommitValidateHook`
- `createToolCallBudgetHook`
- `createDriftDetectorHook`
- `createReadBeforeWriteHook`
- `getLearningStoreForIPC`
- `disposeLearningStore`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import { LearningStore } from "./learning-store.js";
import { app } from "electron";
import { join, basename } from "path";
import { existsSync } from "fs";
import type { SyncHookJSONOutput } from "@anthropic-ai/claude-agent-sdk";

let storeInstance: LearningStore | null = null;

function getLearningStore(): LearningStore | null {
  if (storeInstance) return storeInstance;
  try {
    const userDataPath = app.getPath("userData");
    const dbPath = join(userDataPath, "learning-store.db");
    storeInstance = new LearningStore(dbPath);
    return storeInstance;
  } catch {
    return null;
  }
}

// ─── Secret Scan Patterns ───────────────────────────────────────────
const SECRET_PATTERNS = [
  { name: "AWS Access Key", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "AWS Secret Key", re: /\b(?:aws_)?secret(?:_access)?_key\s*[=:]\s*["']?[A-Za-z0-9/+=]{40}["']?/i },
  { name: "GitHub Token", re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
  { name: "GitHub Fine-Grained Token", re: /\bgithub_pat_[A-Za-z0-9_]{82}\b/ },
  { name: "Anthropic API Key", re: /\bsk-ant-[A-Za-z0-9_\-]{20,}\b/ },
  { name: "OpenAI API Key", re: /\bsk-(?:proj-)?(?!ant-)[A-Za-z0-9_\-]{20,}\b/ },
  { name: "Slack Token", re: /\bxox[baprs]-[A-Za-z0-9\-]{10,}\b/ },
  { name: "Google API Key", re: /\bAIza[0-9A-Za-z_\-]{35}\b/ },
  { name: "Stripe Secret Key", re: /\bsk_live_[0-9a-zA-Z]{24,}\b/ },
  { name: "Private Key Block", re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/ },
  { name: "Generic Bearer Token", re: /\bBearer\s+[A-Za-z0-9_\-.=]{30,}/ },
  { name: "Generic Password Assignment", re: /\b(?:password|passwd|pwd)\s*[=:]\s*["'][^"'\s]{8,}["']/i },
  { name: "Generic Secret Assignment", re: /\b(?:api[_\-]?key|api[_\-]?secret|secret|token)\s*[=:]\s*["'][A-Za-z0-9_\-]{20,}["']/i },
];

const SECRET_ALLOWLIST = [
  /example|placeholder|your[_\-]?(?:api[_\-]?)?key|xxx+|\*{4,}|<[A-Z_]+>/i,
  /process\.env\./,
  /os\.getenv|os\.environ/,
];

function scanForSecrets(content: string): { name: string; snippet: string; line: number } | null {
  if (!content) return null;
  for (const { name, re } of SECRET_PATTERNS) {
    const m = content.match(re);
    if (!m) continue;
    const snippet = m[0];
    const matchIndex = m.index ?? 0;
    const line = content.slice(0, matchIndex).split("\n").length;
    const lineEndIndex = content.indexOf("\n", matchIndex);
    const wholeLine = content.slice(
      content.lastIndexOf("\n", matchIndex - 1) + 1,
      lineEndIndex >= 0 ? lineEndIndex : content.length,
    );
    if (SECRET_ALLOWLIST.some(a => a.test(wholeLine))) continue;
    return { name, snippet: snippet.slice(0, 40), line };
  }
  return null;
}

// ─── Git Blast Radius ───────────────────────────────────────────────
const GIT_PREFIX = /\bgit(?:\s+(?:-[cC]\s+\S+|--\S+(?:=\S+)?|-[a-zA-Z]+))*\s+/;
function sub(pattern: RegExp): RegExp {
  return new RegExp(GIT_PREFIX.source + pattern.source);
}

const GIT_BLOCK = [
  { name: "force push (--force / -f)", re: sub(/push\s+(?:[^\s]+\s+)*(?:-f\b|--force\b)(?!-with-lease)/) },
  { name: "hard reset", re: sub(/reset\s+(?:[^\s]+\s+)*--hard\b/) },
  { name: "working-tree clean", re: sub(/clean\s+(?:[^\s]*f)/) },
  { name: "branch deletion (-D)", re: sub(/branch\s+(?:[^\s]+\s+)*-D\b/) },
  { name: "checkout discard (.)", re: sub(/checkout\s+(?:--\s+)?\.\s*$/) },
  { name: "restore discard (.)", re: sub(/restore\s+(?:[^\s]+\s+)*\.\s*$/) },
  { name: "stash drop/clear", re: sub(/stash\s+(?:drop|clear)\b/) },
  { name: "remote branch delete (--delete)", re: sub(/push\s+(?:[^\s]+\s+)*--delete\b/) },
];

// ─── Conventional Commit Validation ─────────────────────────────────
const COMMIT_TYPES = ["feat", "fix", "refactor", "test", "docs", "chore", "perf", "ci", "style", "build", "revert"];
const COMMIT_PATTERN = new RegExp(`^(${COMMIT_TYPES.join("|")})(\\([\\w\\-.,/ ]+\\))?!?: .+`);
const MAX_COMMIT_SUMMARY = 72;

function validateCommitMessage(command: string): { ok: boolean; reason?: string } {
  const shortFlag = command.match(/(?:^|\s)-m\s+(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|(\S+))/);
  const longFlag = command.match(/--message(?:=|\s+)(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|(\S+))/);
  const raw = shortFla
... (truncated)
```
