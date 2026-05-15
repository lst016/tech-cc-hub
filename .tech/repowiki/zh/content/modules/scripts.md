# scripts

> 构建、开发、发布和QA测试的自动化脚本集合

该模块包含用于Electron应用生命周期管理的各类脚本：Windows打包后图标设置、Codex OAuth配置、开发和发布流程自动化、GitHub Release生成、知识引擎同步以及多场景QA冒烟测试。

## 文件

### `after-pack-win-icon.cjs`

Electron打包后钩子，用于Windows平台设置应用的.ico图标

- `applyWindowsIconAfterPack` (function) - 主导出函数，在electron-builder打包完成后检查平台，若为win32则使用rcedit.exe将icon.ico嵌入exe

### `codex-oauth-setup.mjs`

配置Codex OAuth认证，更新API配置文件中的模型列表和凭证

- `parseArgs` (function) - 解析命令行参数，支持--key=value和--flag value两种格式
- `getDefaultConfigPath` (function) - 根据平台返回API配置文件路径，优先读取TECH_CC_HUB_API_CONFIG环境变量
- `readSettings` (function) - 读取并解析JSON配置文件，支持旧格式（单profile）和新格式（profiles数组）
- `writeSettings` (function) - 创建目录并写入JSON配置
- `buildCodexProfile` (function) - 构建Codex OAuth配置profile，包含模型列表和认证声明

### `dev-electron.mjs`

Electron开发环境准备和macOS分发路径验证

- `run` (function) - 同步执行命令，失败时抛出带输出的错误
- `runOptional` (function) - 执行可选命令，忽略错误和输出
- `verifyCodesign` (function) - 使用codesign验证应用签名
- `electronVersionLabel` (function) - 从package.json提取Electron版本号并规范化
- `cleanMacExtendedAttributes` (function) - 清除macOS扩展属性（FinderInfo、quarantine等），避免签名验证问题
- `prepareMacElectronDist` (function) - 设置ELECTRON_OVERRIDE_DIST_PATH环境变量，使开发时使用本地node_modules中的Electron

### `dev.mjs`

同时启动React和Electron开发服务器

- `stopAll` (function) - 终止所有子进程并退出，响应SIGINT/SIGTERM信号
- `startTask` (function) - 启动npm子进程，监听exit事件，任一任务失败则终止全部

### `github-release.mjs`

自动化GitHub Release流程，包括版本计算、变更日志生成和资产上传

- `parseVersion` (function) - 解析语义化版本字符串为{major,minor,patch,value}对象
- `run` (function) - 执行git/gh命令，支持dry-run模式跳过实际执行
- `determineNextVersion` (function) - 根据semver bump类型（major/minor/patch）计算下一个版本号
- `createGitHubRelease` (function) - 调用gh CLI创建GitHub Release并上传tarball/zip资产
- `generateReleaseNotes` (function) - 从git log生成包含标题、提交、变更文件的发布说明

### `package-win-safe.mjs`

安全的Windows打包流程，清理旧产物并生成稳定输出文件

- `cleanOldArtifacts` (function) - 删除win-unpacked、缓存图标和旧版本exe/zip
- `findExeArtifact` (function) - 在dist目录中查找tech-cc-hub*.exe文件
- `createStableOutputs` (function) - 生成带日期戳的zip文件（tech-cc-hub-win-{date}.zip）和无后缀exe副本
- `makeZipFromDir` (function) - 使用tar创建win-unpacked目录的zip压缩包
- `hasUnpackedArtifact` (function) - 检查是否存在win-unpacked目录作为备选

### `sync-claude-code-compat.mjs`

从Claude Code官方changelog同步命令兼容性信息到TypeScript注册表

- `normalizeVersion` (function) - 规范化版本号，处理v前缀并修正v0.2.x为v2.1.x
- `fetchText` (function) - 使用fetch获取changelog页面文本
- `extractSections` (function) - 从HTML提取各版本变更章节，包含version、date、items
- `extractCommandItems` (function) - 从变更项中提取命令相关提示
- `buildPromptHints` (function) - 构建prompt提示模板供LLM理解命令语义
- `renderRegistry` (function) - 生成TypeScript类型定义文件内容

### `qa/browser-workbench-smoke.mjs`

BrowserWorkbenchManager冒烟测试，验证浏览器内核的页面加载、元素提取和控制台功能

- `waitForIdle` (function) - 轮询等待页面加载完成（url存在且非loading状态）
- `makeFixture` (function) - 在临时目录创建两个HTML测试页面，包含链接、图片和console日志
- `run` (async function) - 主测试入口，创建BrowserWindow和BrowserWorkbenchManager，逐项检查extract/inspect/capture/console功能

### `qa/chat-ui-smoke.cjs`

Playwright驱动的Chat UI冒烟测试，验证@文件提及和/slash命令功能

- `main` (async function) - 启动headless Chrome，测试@src文件提及触发、slash命令弹窗、结构化引用不泄露到textarea、控制台错误检测

### `qa/electron-autostart-smoke.sh`

Shell脚本测试Electron自启动和Session完成流程，通过SQLite数据库轮询验证任务状态

- `cleanup` (function) - EXIT陷阱清理：杀死子进程、删除锁目录
- `wait_for_vite` (function) - 轮询等待Vite开发服务器在localhost:5173就绪
- `poll_for_completion` (function) - 轮询sessions.db表中last_prompt匹配的行，等待status=completed且claude_session_id非空

### `qa/knowledge-chat-injection-smoke.mjs`

测试知识库聊天的注入功能，验证overview生成和streaming回复

- `callBridge` (function) - 通过HTTP POST调用bridge RPC方法
- `subscribeServerEvents` (function) - 订阅SSE事件流，解析data:行并触发回调
- `main` (async function) - 调用knowledge:overview检查<knowledge_overview>标签，订阅server事件等待assistant消息并验证知识注入内容

### `qa/knowledge-engine-smoke.mjs`

验证知识库索引引擎的完整流程，包括sqlite-vec向量存储和Repo Wiki多页生成

- `readJson` (function) - 读取并解析JSON文件，文件不存在则报错
- `sqlite` (function) - 执行SQLite查询并返回结果
- `latestKnowledgeDb` (function) - 在knowledge目录查找最新的knowledge.sqlite文件
- `walkMarkdown` (function) - 递归遍历目录返回.md文件列表（排除_sidebar.md）

## 关键概念

- **Electron After-Pack Hook**：electron-builder在打包完成后触发回调，after-pack-win-icon.cjs利用此钩子修改已打包exe的图标资源
- **多进程并发管理**：dev.mjs同时管理React(Vite)和Electron两个子进程，任一失败则终止全部
- **OAuth凭证管理**：codex-oauth-setup.mjs处理OpenAI Codex的OAuth认证流程，持久化到跨平台配置文件
- **macOS签名清理**：dev-electron.mjs清除扩展属性(xattr)以确保本地Electron能被codesign验证
- **Semantic Version Bump**：github-release.mjs支持major/minor/patch三种版本递增策略
- **SSE事件流订阅**：knowledge-chat-injection-smoke.mjs通过fetch+ReadableStream解析Server-Sent Events
- **SQLite数据库轮询**：electron-autostart-smoke.sh通过sqlite3命令轮询sessions.db验证任务完成状态
- **向量检索验证**：knowledge-engine-smoke.mjs检查sqlite-vec扩展的indexedDocuments和indexedChunks数量
- **Playwright浏览器自动化**：chat-ui-smoke.cjs使用Playwright的chromium启动headless浏览器进行UI交互测试
- **文件协议测试**：browser-workbench-smoke.mjs用pathToFileURL创建本地HTML文件URL供BrowserWorkbenchManager加载

## 内部关系

- `package-win-safe.mjs` -> `after-pack-win-icon.cjs`：electron-builder在afterPack钩子中调用after-pack-win-icon.cjs设置Windows图标
- `dev.mjs` -> `dev-electron.mjs`：dev.mjs执行npm run dev:electron，该脚本内部import dev-electron.mjs准备Electron环境
- `github-release.mjs` -> `package-win-safe.mjs`：Release流程调用package-win-safe.mjs构建产物后上传tarball
- `sync-claude-code-compat.mjs` -> `dist-electron/electron/browser-manager.js`：sync脚本输出到src/electron/libs/claude-code-compat-registry.ts供BrowserWorkbenchManager使用
- `qa/browser-workbench-smoke.mjs` -> `dist-electron/electron/browser-manager.js`：冒烟测试导入BrowserWorkbenchManager类进行功能测试
