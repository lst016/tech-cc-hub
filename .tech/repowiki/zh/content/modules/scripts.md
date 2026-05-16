# scripts

> Development, packaging, and QA scripts for the Desktop Agent workbench

scripts模块包含用于开发、构建打包、Claude Code兼容性同步、以及各类端到端冒烟测试的脚本文件。这些脚本协同工作，支持开发环境启动、Windows安全打包、OAuth认证设置、以及对browser workbench、knowledge引擎、chat UI等核心模块的质量验证。

## 文件

### `scripts/codex-oauth-setup.mjs`

配置Codex OAuth认证，建立API配置文件，支持profile管理和JWT凭证存储

- `parseArgs` (function) - 解析命令行参数，支持--key=value和--key value两种格式
- `getDefaultConfigPath` (function) - 根据平台返回tech-cc-hub配置文件路径，遵循XDG规范
- `buildCodexProfile` (function) - 构建Codex profile对象，整合JWT凭证、模型列表和API配置
- `loadCodexCredential` (function) - 从.codex/auth.json加载JWT凭证并解码exp字段
- `runCodexLogin` (function) - 启动交互式OAuth登录流程，获取并保存凭证
- `jwtExpiresAt` (function) - 从JWT payload中提取过期时间戳

### `scripts/dev-electron.mjs`

准备macOS签名Electron运行时缓存并启动electron进程

- `prepareMacElectronDist` (function) - 检查或创建Electron.app签名缓存，包括codesign验证和xattr清理
- `verifyCodesign` (function) - 使用codesign --verify --deep验证应用签名状态
- `cleanMacExtendedAttributes` (function) - 清除Finder Info、provenance等macOS扩展属性
- `electronVersionLabel` (function) - 从package.json提取electron版本号

### `scripts/package-win-safe.mjs`

Windows平台打包脚本，支持多策略降级和稳定输出文件名

- `runWithFallback` (function) - 执行打包命令，失败时自动降级到备用策略
- `cleanOldArtifacts` (function) - 清理旧的win-unpacked和exe产物，防止版本混淆
- `createStableOutputs` (function) - 生成带有日期戳的稳定输出文件（exe和zip）
- `findExeArtifact` (function) - 扫描dist目录找到tech-cc-hub可执行文件

### `scripts/sync-claude-code-compat.mjs`

从claudelog.com抓取Claude Code changelog并生成TypeScript兼容性注册表

- `extractSections` (function) - 解析HTML页面，按版本号提取changelog段落
- `extractCommandItems` (function) - 从changelog条目中提取/command命令和agents/plugin关键词
- `buildPromptHints` (function) - 根据命令描述生成prompt提示符注册表
- `renderRegistry` (function) - 将registry对象渲染为TypeScript源码并写入文件

### `scripts/after-pack-win-icon.cjs`

electron-builder的afterPack钩子，在打包后为Windows exe嵌入icon

- `applyWindowsIconAfterPack` (function) - main导出函数，使用rcedit.exe为exe设置图标文件

### `scripts/dev.mjs`

开发环境启动器，同时运行React(Vite)和Electron进程

- `startTask` (function) - 启动npm子任务，管理子进程生命周期和退出处理
- `stopAll` (function) - 统一终止所有子进程并退出，响应SIGINT/SIGTERM信号

### `scripts/qa/browser-workbench-smoke.mjs`

冒烟测试BrowserWorkbenchManager核心功能：导航、提取、检查、截图、控制台捕获

- `waitForIdle` (function) - 等待browser manager完成加载且有URL
- `makeFixture` (function) - 在tmp目录创建测试用HTML文件，包含链接、图片和console脚本
- `check` (function) - 执行单个检查项，捕获成功结果或错误信息

### `scripts/qa/knowledge-chat-injection-smoke.mjs`

验证knowledge overview被正确注入到chat系统prompt中

- `subscribeServerEvents` (function) - 通过SSE订阅chat事件流，解析data帧
- `callBridge` (function) - 通过fetch调用bridge RPC接口
- `extractAssistantText` (function) - 从assistant消息中提取text content pieces

### `scripts/qa/knowledge-engine-smoke.mjs`

验证knowledge引擎索引状态、Repo Wiki生成质量和sqlite-vec可用性

- `latestKnowledgeDb` (function) - 查找最新的knowledge.sqlite数据库文件
- `walkMarkdown` (function) - 递归遍历目录收集所有markdown文件
- `sqlite` (function) - 通过sqlite3 CLI执行SQL查询并返回结果

### `scripts/qa/knowledge-ui-smoke.cjs`

Playwright测试knowledge UI的Repo Wiki标签页、workspace切换和模块按钮渲染

- `clickIfVisible` (function) - 安全点击元素，仅当可见时执行点击
- `main` (function) - 主测试流程：启动Chrome、导航到知识库、验证生成的概览内容

### `scripts/qa/preview-workbench-smoke.cjs`

Playwright测试预览工作台的Monaco编辑器加载、文件选择和代码引用chip渲染

- `main` (function) - 主测试流程：打开预览、选择package.json、模拟文本选择和粘贴操作

### `scripts/qa/chat-ui-smoke.cjs`

Playwright测试chat UI的文件提及、slash命令和引用块隔离

- `main` (function) - 主测试流程：点击textarea、输入@src、验证文件提及弹窗和引用card渲染

### `scripts/qa/electron-autostart-smoke.sh`

Shell脚本验证electron自动启动会话流程，检查sessions.db完成状态

- `poll_for_completion` (function) - 轮询sessions表直到状态变为completed或超时
- `wait_for_vite` (function) - 等待Vite开发服务器就绪，超时时间20秒

### `scripts/qa/window-id-tools.sh`

macOS窗口ID查询和截图工具，用于获取Electron/Chrome窗口信息

- `list_windows` (function) - 用Swift/CoreGraphics列出Electron和Chrome窗口的ID、owner、layer和name
- `capture_window` (function) - 使用screencapture -l截取指定窗口ID的PNG图片

## 关键概念

- **codesign签名验证**: macOS Electron分发需要通过Apple Developer ID签名，dev-electron.mjs使用codesign --verify --deep验证签名状态，失败则报错防止发布未签名应用
- **Electron Override Dist**: 通过ELECTRON_OVERRIDE_DIST_PATH环境变量指向预签名缓存目录，避免每次开发时重复签名操作，加速启动
- **多策略打包降级**: package-win-safe.mjs使用runWithFallback模式，当electron-builder默认配置失败时自动尝试无签名配置，适应不同构建环境
- **稳定输出文件名**: createStableOutputs在dist目录生成带日期戳的exe和zip文件（如tech-cc-hub-win-x64-20240101.exe），避免CI覆盖问题
- **Claude Code Compat Registry**: sync-claude-code-compat.mjs从claudelog.com抓取changelog，提取命令列表和prompt hints，生成TypeScript注册表供Agent识别Claude Code版本特有命令
- **SSE事件订阅**: knowledge-chat-injection-smoke.mjs通过fetch订阅/events/server端点，使用SSE协议解析data帧获取chat实时事件流
- **sqlite-vec向量索引**: knowledge-engine-smoke.mjs验证sqlite-vec扩展已就绪且索引文档数达标（≥20），确认Agent可执行语义搜索
- **BrowserWorkbenchManager**: browser-workbench-smoke.mjs导入的BrowserWorkbenchManager封装了Electron BrowserWindow操作，提供open、inspect、capture、extract等高层接口

## 内部关系

- `scripts/dev.mjs` → `scripts/dev-electron.mjs`: dev.mjs通过npm run命令调用dev-electron.mjs，后者设置ELECTRON_OVERRIDE_DIST_PATH后启动electron
- `scripts/package-win-safe.mjs` → `scripts/after-pack-win-icon.cjs`: package-win-safe.mjs在打包完成后调用after-pack-win-icon.cjs作为electron-builder钩子嵌入图标
- `scripts/sync-claude-code-compat.mjs` → `src/electron/libs/claude-code-compat-registry.ts`: sync脚本将生成的TypeScript注册表写入claude-code-compat-registry.ts供electron libs模块使用
- `scripts/qa/*-smoke.cjs` → `@playwright/test`: 所有CJS冒烟测试脚本导入playwright/test库执行浏览器自动化测试
- `scripts/qa/browser-workbench-smoke.mjs` → `dist-electron/electron/browser-manager.js`: browser-workbench-smoke导入预编译的BrowserWorkbenchManager类进行集成测试
