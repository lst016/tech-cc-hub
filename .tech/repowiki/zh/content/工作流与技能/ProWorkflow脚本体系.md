# ProWorkflow脚本体系

<cite>
**本文引用的文件**
- [pro-workflow/scripts/cwd-changed.js](file://pro-workflow/scripts/cwd-changed.js#L1-L40)
- [pro-workflow/scripts/commit-validate.js](file://pro-workflow/scripts/commit-validate.js#L1-L80)
- [pro-workflow/scripts/config-watcher.js](file://pro-workflow/scripts/config-watcher.js#L1-L91)
- [pro-workflow/scripts/git-blast-radius.js](file://pro-workflow/scripts/git-blast-radius.js#L1-L65)
- [pro-workflow/scripts/research-tick.js](file://pro-workflow/scripts/research-tick.js#L1-L77)
- [pro-workflow/scripts/secret-scan.js](file://pro-workflow/scripts/secret-scan.js#L1-L68)
- [pro-workflow/scripts/drift-detector.js](file://pro-workflow/scripts/drift-detector.js#L1-L126)
- [pro-workflow/config.json](file://pro-workflow/config.json#L1-L48)
- [src/electron/libs/runner.ts](file://src/electron/libs/runner.ts#L1-L1924)
- [src/electron/libs/runner-reuse.ts](file://src/electron/libs/runner-reuse.ts#L1-L119)
- [src/electron/main.ts](file://src/electron/main.ts#L1-L2917)
- [src/electron/preload.cts](file://src/electron/preload.cts#L1-L206)
- [src/electron/libs/system-prompt-presets.ts](file://src/electron/libs/system-prompt-presets.ts#L1-L176)
- [pro-workflow/package.json](file://pro-workflow/package.json#L1-L70)
- [pro-workflow/tsconfig.json](file://pro-workflow/tsconfig.json#L1-L21)
- [pro-workflow/mcp-config.example.json](file://pro-workflow/mcp-config.example.json#L1-L47)
- [pro-workflow/README.md](file://pro-workflow/README.md#L1-L466)
</cite>

# ProWorkflow 脚本体系

## 目录

1. [设计理念与整体架构](#1-设计理念与整体架构)
2. [脚本分类与职责](#2-脚本分类与职责)
3. [协议层：stdin/stdout JSON](#3-协议层stdinstdout-json)
4. [脚本调用关系图](#4-脚本调用关系图)
5. [配置与扩展方式](#5-配置与扩展方式)
6. [关键脚本详解](#6-关键脚本详解)
7. [运行时数据流](#7-运行时数据流)
8. [失败模式与排障](#8-失败模式与排障)
9. [Agent 改代码地图](#9-agent-改代码地图)
10. [前后端桥接点](#10-前后端桥接点)

---

## 1. 设计理念与整体架构

ProWorkflow 脚本体系是一套**事件驱动、质量门禁优先**的脚本集合，运行在 Claude Code 会话的生命周期内。每个脚本通过 `stdin` 接收结构化输入，通过 `stdout` 回传处理结果，形成**无状态过滤器**模式。

核心设计原则：

- **即插即用**：每个脚本独立执行，失败默认 `exit(0)`（静默放行），危险操作返回 `exit(2)`
- **JSON 协议**：所有数据通过 `process.stdin` / `process.stdout` 传递 JSON
- **零依赖**：纯 Node.js，无需构建
- **可覆盖**：`process.env` 环境变量提供运行时开关

图表来源：[pro-workflow/README.md#L36-L42](file://pro-workflow/README.md#L36-L42)

---

## 2. 脚本分类与职责

### 2.1 会话生命周期类

| 脚本 | 入口事件 | 职责 |
|------|---------|------|
| `cwd-changed.js` | 目录切换 | 检测 `.git`、`package.json`、`CLAUDE.md` 存在性，写入 `PRO_WORKFLOW_PROJECT_TYPE` |
| `drift-detector.js` | 每次 prompt | 提取原始意图关键词，6 次编辑后若 relevance < 0.2 触发提醒 |

### 2.2 质量门禁类

| 脚本 | 触发条件 | 退出码 |
|------|---------|-------|
| `commit-validate.js` | `git commit` 调用时 | 0=通过, 2=格式错误 |
| `secret-scan.js` | 文件写入时 | 0=无泄露, 2=检测到密钥 |
| `git-blast-radius.js` | 任意 `git` 命令 | 0=安全, 2=危险操作 |
| `config-watcher.js` | 配置文件变更 | 0=记录日志 |

### 2.3 协作流程类

| 脚本 | 调度方式 | 职责 |
|------|---------|------|
| `research-tick.js` | cron / 手动触发 | 检查 wiki 自动研究开关，驱动 `skills/wiki-research-loop/scripts/research-loop.js` |
| `config-watcher.js` | Claude Code 2.1.49+ 内置 hook | 监控 `settings.json`、`hooks.json` 变更 |

---

## 3. 协议层：stdin/stdout JSON

### 3.1 标准输入格式

```javascript
// 工具调用场景
{
  "tool_input": {
    "command": "git commit -m 'fix: resolve auth bug'",
    "file_path": "/path/to/file.js",
    "content": "const AWS_KEY = 'AKIA...'"
  }
}

// 配置变更场景
{
  "config_file": "~/.claude/settings.json",
  "file": "settings.json",
  "changes": {}
}

// 目录切换场景
{
  "cwd": "/home/user/project",
  "session_id": "abc123"
}
```

### 3.2 标准输出格式

```javascript
// 大多数脚本：透传原 JSON
console.log(data);

// research-tick.js：返回结构化结果
console.log(JSON.stringify({
  ran: "agent-memory",
  skipped: null,
  exit: 0,
  error: null
}));
```

### 3.3 readStdin 辅助函数

所有脚本共用 `readStdin()` 模式：

```javascript
// 出处：pro-workflow/scripts/commit-validate.js#L6-L13
function readStdin() {
  return new Promise(resolve => {
    let data = '';
    process.stdin.on('data', c => { data += c; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(''));
  });
}
```

章节来源：[commit-validate.js#L6-L13](file://pro-workflow/scripts/commit-validate.js#L6-L13)

---

## 4. 脚本调用关系图

```mermaid
flowchart TD
    subgraph Electron主进程
        A[runner.ts runClaude] --> B[learning-hooks.ts]
        B --> C[createSecretScanHook]
        B --> D[createGitBlastRadiusHook]
        B --> E[createCommitValidateHook]
        B --> F[createDriftDetectorHook]
    end

    subgraph ProWorkflow脚本
        G[secret-scan.js] --> H{检测结果}
        I[git-blast-radius.js] --> H
        J[commit-validate.js] --> H
        K[cwd-changed.js] --> L[写入CLAUDE_ENV_FILE]
        M[drift-detector.js] --> N[写入/tmp/pro-workflow/]
    end

    C --> G
    D --> I
    E --> J

    O[research-tick.js] --> P[spawnSync research-loop.js]
    Q[config-watcher.js] --> R[写入~/.pro-workflow/]
```

图表来源：[runner.ts#L19-L29](file://src/electron/libs/runner.ts#L19-L29)

---

## 5. 配置与扩展方式

### 5.1 config.json 主配置

```json
// pro-workflow/config.json
{
  "quality_gates": {
    "run_lint": true,
    "run_typecheck": true,
    "run_tests": true,
    "lint_command": "npm run lint",
    "typecheck_command": "npm run typecheck",
    "test_command": "npm test -- --related"
  },
  "self_correction": {
    "enabled": true,
    "auto_update_claude_md": false,
    "require_approval": true
  }
}
```

章节来源：[pro-workflow/config.json#L21-L28](file://pro-workflow/config.json#L21-L28)

### 5.2 环境变量覆盖

| 变量 | 作用域 | 效果 |
|------|-------|------|
| `PRO_WORKFLOW_ALLOW_UNSAFE_GIT=1` | `git-blast-radius.js` | 跳过危险 git 操作拦截 |
| `CLAUDE_ENV_FILE` | `cwd-changed.js` | 追加 `PRO_WORKFLOW_PROJECT_TYPE` |
| `CLAUDE_SESSION_ID` | `drift-detector.js` | 标识会话状态文件 |
| `STOP_FILE` (~/.pro-workflow/STOP) | `research-tick.js` | 停止自动研究循环 |

### 5.3 Hook 注册入口

```typescript
// src/electron/libs/runner.ts#L19-L29
import {
  createLearnCaptureHook,
  createCorrectionDetectionHook,
  createQualityGateHook,
  createSecretScanHook,
  createGitBlastRadiusHook,
  createCommitValidateHook,
  createToolCallBudgetHook,
  createDriftDetectorHook,
  createReadBeforeWriteHook,
} from "./learning-hooks.js";
```

扩展新脚本：在 `learning-hooks.ts` 添加 `createXxxHook`，在 `runner.ts` 注册。

章节来源：[runner.ts#L19-L29](file://src/electron/libs/runner.ts#L19-L29)

---

## 6. 关键脚本详解

### 6.1 secret-scan.js

**职责**：扫描文件内容中的泄露密钥。

**支持的模式**：

```javascript
// pro-workflow/scripts/secret-scan.js#L2-L16
const PATTERNS = [
  { name: 'AWS Access Key',      re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'AWS Secret Key',      re: /\b(?:aws_)?secret(?:_access)?_key\s*[=:]/i },
  { name: 'GitHub Token',         re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
  { name: 'Anthropic API Key',    re: /\bsk-ant-[A-Za-z0-9_\-]{20,}\b/ },
  { name: 'OpenAI API Key',       re: /\bsk-(?:proj-)?(?!ant-)[A-Za-z0-9_\-]{20,}\b/ },
  { name: 'Private Key Block',    re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/ },
  // ... 更多模式
];
```

**白名单规则**：
```javascript
// pro-workflow/scripts/secret-scan.js#L18-L22
const ALLOWLIST = [
  /example|placeholder|your[_\-]?(?:api[_\-])?key|xxx+|\*{4,}|<[A-Z_]+>/i,
  /process\.env\./,
  /os\.getenv|os\.environ/,
];
```

**调用示例**：
```bash
echo '{"tool_input": {"content": "const key = \"sk-ant-abc123\"", "file_path": "src/config.js"}}' | node scripts/secret-scan.js
# 输出: [pro-workflow] secret-scan: detected Anthropic API Key near line 1...
# 退出码: 2
```

章节来源：[secret-scan.js#L2-L68](file://pro-workflow/scripts/secret-scan.js#L2-L68)

---

### 6.2 git-blast-radius.js

**职责**：拦截破坏性 git 操作。

**拦截规则**（BLOCK 列表）：

```javascript
// pro-workflow/scripts/git-blast-radius.js#L8-L23
const BLOCK = [
  { name: 'force push (--force / -f)',    re: sub(/push\s+(?:[^\s]+\s+)*(?:-f\b|--force\b)(?!-with-lease)/) },
  { name: 'hard reset',                   re: sub(/reset\s+(?:[^\s]+\s+)*--hard\b/) },
  { name: 'working-tree clean (-f)',      re: sub(/clean\s+(?:[^\s]*f)/) },
  { name: 'branch deletion (-D)',          re: sub(/branch\s+(?:[^\s]+\s+)*-D\b/) },
  // ... 更多规则
];
```

**警告但不拦截**（WARN_NOT_BLOCK）：
```javascript
// pro-workflow/scripts/git-blast-radius.js#L25-L27
const WARN_NOT_BLOCK = [
  { name: 'force-with-lease push', re: sub(/push\s+(?:[^\s]+\s+)*--force-with-lease\b/) },
];
```

**覆盖方式**：
```bash
export PRO_WORKFLOW_ALLOW_UNSAFE_GIT=1
```

章节来源：[git-blast-radius.js#L8-L54](file://pro-workflow/scripts/git-blast-radius.js#L8-L54)

---

### 6.3 commit-validate.js

**职责**：验证 commit message 符合 Conventional Commits。

**类型白名单**：
```javascript
// pro-workflow/scripts/commit-validate.js#L2
const TYPES = ['feat', 'fix', 'refactor', 'test', 'docs', 'chore', 'perf', 'ci', 'style', 'build', 'revert'];
```

**正则模式**：
```javascript
// pro-workflow/scripts/commit-validate.js#L3
const PATTERN = new RegExp(`^(${TYPES.join('|')})(\\([\\w\\-.,/ ]+\\))?!?: .+`);
```

**摘要长度限制**：72 字符

**消息提取逻辑**：支持 `-m`/`--message`、heredoc、`-F` 文件模式。

章节来源：[commit-validate.js#L1-L79](file://pro-workflow/scripts/commit-validate.js#L1-L79)

---

### 6.4 drift-detector.js

**职责**：检测用户意图漂移。

**状态文件路径**：
```javascript
// pro-workflow/scripts/drift-detector.js#L33-L37
const tempDir = getTempDir(); // os.tmpdir()/pro-workflow
const intentFile = path.join(tempDir, `intent-${sessionId}`); // intent-{sessionId}
const editLogFile = path.join(tempDir, `edit-log-${sessionId}`); // edit-log-{sessionId}
```

**漂移触发条件**：
```javascript
// pro-workflow/scripts/drift-detector.js#L62
if (state.editsSinceLastTouch >= 6 && relevance < 0.2) {
  log('[ProWorkflow] Drift check: ...');
}
```

章节来源：[drift-detector.js#L52-L67](file://pro-workflow/scripts/drift-detector.js#L52-L67)

---

### 6.5 research-tick.js

**职责**：驱动 wiki 自动研究循环。

**依赖检查**：
```javascript
// pro-workflow/scripts/research-tick.js#L12-L16
function getStore() {
  const distPath = path.join(PRO_WORKFLOW_ROOT, 'dist', 'db', 'store.js');
  if (!fs.existsSync(distPath)) { console.error('build store first'); process.exit(1); }
  return require(distPath).createStore();
}
```

**调度逻辑**：
1. 读取 `~/.pro-workflow/STOP`，若存在则跳过
2. 遍历 wiki 列表，检查 `wiki.config.md` 中 `auto_research.enabled`
3. 查询 `wiki_seeds` 表中 `status='pending'` 的种子
4. 触发 `spawnSync('node', [LOOP_SCRIPT, 'run', target.slug, '--max-pages', '1'])`

章节来源：[research-tick.js#L44-L72](file://pro-workflow/scripts/research-tick.js#L44-L72)

---

### 6.6 config-watcher.js

**职责**：监控 Claude Code 配置文件变更。

**监控文件列表**：
```javascript
// pro-workflow/scripts/config-watcher.js#L43-L48
const sensitiveFiles = [
  'settings.json',
  'settings.local.json',
  'hooks.json',
  '.claudeignore'
];
```

**日志输出路径**：`~/.pro-workflow/config-changes.log`

章节来源：[config-watcher.js#L43-L76](file://pro-workflow/scripts/config-watcher.js#L43-L76)

---

### 6.7 cwd-changed.js

**职责**：检测工作目录上下文变化。

**检测规则**：
```javascript
// pro-workflow/scripts/cwd-changed.js#L12-L15
const hasGit = fs.existsSync(path.join(newCwd, '.git'));
const hasPackageJson = fs.existsSync(path.join(newCwd, 'package.json'));
const hasClaude = fs.existsSync(path.join(newCwd, 'CLAUDE.md')) || fs.existsSync(path.join(newCwd, '.claude'));
```

**项目类型推断**：`node`、`rust`、`go`、`python`

章节来源：[cwd-changed.js#L11-L27](file://pro-workflow/scripts/cwd-changed.js#L11-L27)

---

## 7. 运行时数据流

```mermaid
sequenceDiagram
    participant User as 用户/Agent
    participant Runner as runner.ts
    participant Hook as learning-hooks.ts
    participant Script as ProWorkflow Scripts
    participant IPC as preload.cts

    User->>Runner: 触发工具调用
    Runner->>Hook: 创建质量门禁
    Hook->>Script: pipe(JSON) via stdin
    Script->>Script: 分析/验证
    Script-->>Hook: stdout JSON (通过/拒绝)
    Hook-->>Runner: HookResult
    Runner-->>User: 执行结果

    Note over Script: secret-scan.js<br/>commit-validate.js<br/>git-blast-radius.js
    Note over Script: drift-detector.js<br/>cwd-changed.js
    Note over Script: research-tick.js (异步)<br/>config-watcher.js
```

图表来源：[runner.ts#L90-L105](file://src/electron/libs/runner.ts#L90-L105)

---

## 8. 失败模式与排障

### 8.1 常见失败场景

| 场景 | 症状 | 排查命令 |
|------|------|---------|
| secret-scan 误报 | 合法 `process.env.KEY` 被拦截 | 检查 `ALLOWLIST` 正则 |
| git-blast-radius 误拦 | 无法执行 `git push --force-with-lease` | `export PRO_WORKFLOW_ALLOW_UNSAFE_GIT=1` |
| commit-validate 不生效 | commit 通过但格式不对 | 检查 `hooks.json` 是否注册 |
| research-tick 不触发 | wiki 无自动研究 | 检查 `~/.pro-workflow/STOP` 是否存在 |
| drift-detector 过于敏感 | 频繁提示意图漂移 | 调整 `editsSinceLastTouch` 阈值 |

### 8.2 日志位置

| 日志类型 | 路径 |
|---------|------|
| 配置变更日志 | `~/.pro-workflow/config-changes.log` |
| 研究触发日志 | `~/.pro-workflow/tick.log` |
| 漂移检测状态 | `/tmp/pro-workflow/intent-{sessionId}` |
| Runner 复用键 | `RunnerReuseDescriptor` in `runner-reuse.ts` |

### 8.3 IPC 通道检查

```typescript
// src/electron/main.ts 中注册的 IPC handlers
ipcMain.handle: "preview-list-directory"
ipcMain.handle: "sessions:list"
ipcMain.handle: "git:commit"
ipcMain.handle: "browser-open"
// ... 更多在 main.ts#L30
```

章节来源：[main.ts#L30](file://src/electron/main.ts#L30)

---

## 9. Agent 改代码地图

### 9.1 涉及的文件与符号

| 层级 | 文件 | 关键符号/函数 |
|------|------|-------------|
| Hook 入口 | `src/electron/libs/runner.ts` | `runClaude@212`, `createQualityGateHook`, `createSecretScanHook` |
| Hook 定义 | `src/electron/libs/learning-hooks.ts` | `createSecretScanHook`, `createGitBlastRadiusHook` |
| Runner 复用 | `src/electron/libs/runner-reuse.ts` | `buildRunnerReuseKey@28`, `canReuseRunner@32` |
| 系统提示 | `src/electron/libs/system-prompt-presets.ts` | `buildToolCallOptimizationPromptAppend@27`, `buildDesignParityPromptAppend@124` |
| 前端桥接 | `src/electron/preload.cts` | `sendClientEvent`, `onServerEvent` |
| IPC 处理 | `src/electron/main.ts` | `ipcMain.handle` 注册 |
| 脚本目录 | `pro-workflow/scripts/` | 7 个独立脚本 |
| 主配置 | `pro-workflow/config.json` | `quality_gates`, `self_correction` |

### 9.2 修改入口

**添加新脚本**：
1. 在 `pro-workflow/scripts/` 创建 `{name}.js`
2. 实现 `readStdin()` 和 `console.log(JSON.stringify(result))`
3. 在 `learning-hooks.ts` 添加 `create{Name}Hook`
4. 在 `runner.ts` 导入并注册

**修改现有脚本**：
1. 直接编辑 `pro-workflow/scripts/{name}.js`
2. 无需重新构建，直接生效

**修改 Hook 注册逻辑**：
1. 编辑 `src/electron/libs/learning-hooks.ts`
2. 修改后需重新编译 Electron：`npm run build` in `src/electron`

### 9.3 验证命令

```bash
# 测试 secret-scan
echo '{"tool_input": {"content": "AWS_KEY=AKIAIOSFODNN7EXAMPLE", "file_path": "test.js"}}' | node scripts/secret-scan.js

# 测试 commit-validate
echo '{"tool_input": {"command": "git commit -m \"feat: add login\""}}' | node scripts/commit-validate.js

# 测试 git-blast-radius
echo '{"tool_input": {"command": "git push --force"}}' | node scripts/git-blast-radius.js

# 测试 cwd-changed
echo '{"cwd": "/tmp/test-project"}' | node scripts/cwd-changed.js
```

### 9.4 常见回归风险

| 风险点 | 描述 | 缓解措施 |
|--------|------|---------|
| 脚本超时 | `research-tick.js` 10 分钟超时 | `killSignal: 'SIGKILL'` |
| JSON 解析失败 | 非 JSON 输入导致静默放行 | 所有脚本使用 `try/catch` |
| 权限问题 | `/tmp/pro-workflow` 不存在 | `fs.mkdirSync(dir, { recursive: true })` |
| 环境变量缺失 | 未设置 `CLAUDE_ENV_FILE` | 脚本内部检查 `process.env` |

---

## 10. 前后端桥接点

### 10.1 Source of Truth

| 数据类型 | Source of Truth | 刷新边界 |
|---------|----------------|---------|
| Runner 配置 | `config.json` (运行时读取) | 会话重启后生效 |
| Hook 注册 | `learning-hooks.ts` (编译时) | 需重新构建 |
| IPC handlers | `main.ts` (运行时) | 需重启 Electron |
| 脚本状态 | `/tmp/pro-workflow/` (临时文件) | 进程生命周期 |

### 10.2 IPC 通道

```typescript
// preload.cts 暴露的 API
electron.sendClientEvent(event)     // 前端 → 主进程
electron.onServerEvent(callback)   // 主进程 → 前端
ipcInvoke("git:commit", payload)    // 请求-响应
```

章节来源：[preload.cts#L12-L26](file://src/electron/preload.cts#L12-L26)

### 10.3 MCP 工具注册

```typescript
// runner.ts 中的 MCP 服务器注册
const BUILTIN_MCP_TOOL_NAMES = listBuiltinMcpToolNames();
const FIGMA_IMPLEMENTATION_ANCHOR_TOOL_NAMES = new Set([
  "figma_summarize_design",
  "figma_generate_tailwind_code",
  "figma_get_image_urls",
  "figma_audit_design",
]);
```

章节来源：[runner.ts#L146-L151](file://src/electron/libs/runner.ts#L146-L151)

### 10.4 测试入口

```typescript
// main.ts 中用于测试的 handlers
ipcMain.handle: "getStaticData"
ipcMain.handle: "git:snapshot"
ipcMain.handle: "git:commitDetail"
```

章节来源：[main.ts#L29](file://src/electron/main.ts#L29)

---

## 附录：脚本快速参考

```
pro-workflow/scripts/
├── cwd-changed.js       # 目录变更检测 (exit 0)
├── commit-validate.js   # Commit 格式验证 (exit 0/2)
├── config-watcher.js    # 配置文件监控 (exit 0)
├── git-blast-radius.js  # 危险 git 操作拦截 (exit 0/2)
├── research-tick.js     # Wiki 自动研究驱动 (exit 0/1)
├── secret-scan.js       # 密钥泄露检测 (exit 0/2)
└── drift-detector.js    # 意图漂移检测 (exit 0)
```

运行时数据目录：`~/.pro-workflow/` (配置、日志、wiki)
临时文件目录：`/tmp/pro-workflow/` (意图状态、编辑日志)
环境覆盖：`PRO_WORKFLOW_ALLOW_UNSAFE_GIT`、`CLAUDE_ENV_FILE`

---

*文档版本：基于 pro-workflow v3.3.0 和 tech-cc-hub Electron 客户端*