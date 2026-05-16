# scripts/github-release.mjs

> 模块：`git-workbench` · 语言：`javascript` · 行数：444

## 文件职责

这是项目入口文件或运行入口，优先阅读它可以理解启动链路和主流程。

## 关键符号

- `log@58`
- `fail@62`
- `run@67`
- `readPackageJson@95`
- `parseVersion@99`
- `runWithInput@113`
- `bumpVersion@142`
- `resolveReleaseTitle@167`
- `getReleaseNoteTemplate@174`
- `ensureGitRepository@182`
- `ensureCleanWorktree@186`
- `ensureTagDoesNotExist@198`
- `ensureOriginRemote@214`
- `getRepositoryInfo@222`
- `getGithubToken@234`
- `githubApiRequest@253`
- `getPreviousTag@288`
- `getCommitsSinceTag@301`
- `getFilesSinceTag@307`
- `createReleaseBody@318`
- `upsertGithubRelease@347`
- `main@386`
- `cwd@6`
- `packagePath@8`
- `packageLockPath@9`
- `args@10`
- `flags@11`
- `options@12`
- `positionals@13`
- `arg@16`
- `requestedVersion@36`
- `dryRun@38`
- `noPush@39`
- `allowDirty@40`
- `noRelease@41`
- `releaseTitleTemplate@42`
- `releaseNoteTemplatePath@43`
- `GITHUB_API_BASE@44`
- `DEFAULT_RELEASE_NOTE_TEMPLATE@46`
- `result@73`

## 依赖输入

- `node:child_process`
- `node:fs`
- `node:path`
- `node:process`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```javascript
#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const cwd = process.cwd();
const packagePath = path.join(cwd, "package.json");
const packageLockPath = path.join(cwd, "package-lock.json");
const args = process.argv.slice(2);
const flags = new Set();
const options = new Map();
const positionals = [];

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (!arg.startsWith("--")) {
    positionals.push(arg);
    continue;
  }

  const [key, ...rest] = arg.split("=");
  if (rest.length > 0) {
    options.set(key, rest.join("="));
    continue;
  }

  if (i + 1 < args.length && !args[i + 1].startsWith("--")) {
    options.set(key, args[i + 1]);
    i += 1;
    continue;
  }

  flags.add(key);
}

const requestedVersion = positionals[0] ?? "patch";
const dryRun = flags.has("--dry-run");
const noPush = flags.has("--no-push");
const allowDirty = flags.has("--allow-dirty");
const noRelease = flags.has("--no-release");
const releaseTitleTemplate = options.get("--release-title-template") ?? "## {tag} 版本更新";
const releaseNoteTemplatePath = options.get("--release-note-template");

const GITHUB_API_BASE = "https://api.github.com";
const DEFAULT_RELEASE_NOTE_TEMPLATE = `{{title}}

### 变更提交
{{commits}}

### 变更文件
{{files}}

### 说明
- 发布时间（自动生成）：{{generated_at}}
- 来源：{{source}}
`;

function log(message) {
  console.log(`[github-release] ${message}`);
}

function fail(message) {
  console.error(`[github-release] ${message}`);
  process.exit(1);
}

function run(command, commandArgs, options = {}) {
  if (dryRun && options.mutates !== false) {
    log(`dry-run: ${command} ${commandArgs.join(" ")}`);
    return { stdout: "", status: 0 };
  }

  const result = spawnSync(command, commandArgs, {
    cwd,
    env: process.env,
    encoding: "utf8",
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
    shell: false,
  });

  if (result.error) {
    fail(`${command} failed: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const stderr = result.stderr?.trim();
    fail(stderr || `${command} exited with ${result.status}`);
  }

  return {
    stdout: result.stdout?.trim() ?? "",
    status: result.status ?? 0,
  };
}

function readPackageJson() {
  return JSON.parse(readFileSync(packagePath, "utf8"));
}

function parseVersion(value) {
  const normalized = value.replace(/^v/i, "").trim();
  const match = normalized.match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  if (!match) {
    return null;
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    value: normalized,
  };
}

function runWithInput(command, commandArgs, input, options = {}) {
  if (dryRun && options.mutates !== false) {
    log(`dry-run: ${command} ${commandArgs.join(" ")}`);
    return { stdout: "", status: 0 };
  }

  const result = spawnSync(command, commandArgs, {
    cwd,
    env: process.env,
    input,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    shell: false,
  });

  if (result.error) {
    fail(`${command} failed: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const stderr = result.stderr?.trim();
    fail(stderr || `${command} exited with ${result.status}`);
  }

  return {
    stdout: result.stdout?.trim() ?? "",
    status: result.status ?? 0,
  };
}

function bumpVersion(current, mode) {
  const version = parseVersion(current);
  if (!version) {
    fail(`package.json version is not semver: ${current}`);
  }

  if (mode === "major") {
    return `${version.major + 1}.0.0`;
  }
  if (mode === "minor") {
    return `${version.major}.${version.minor + 1}.0`;
  }
  if (mode === "patch") {
    return `${version.major}.${version.minor}.${version.patch + 1}`;
  }

  const explicit = parseVersion(mode);
  if (!explicit) {
    fail(
      "Usage: npm run release:github -- [patch|minor|major|vX.Y.Z] [--dry-run] [--no-push] [--allow-dirty] [--no-release] [--release-title-template \"<tmpl>\"] [--release-note-template <path>]"
    );
  }
  return explicit.value;
}

function resolveReleaseTitle(rawTemplate, tag) {
  return rawTe
... (truncated)
```
