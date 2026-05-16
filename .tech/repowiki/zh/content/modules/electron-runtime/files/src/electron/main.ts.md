# src/electron/main.ts

> 模块：`electron-runtime` · 语言：`typescript` · 行数：2917

## 文件职责

Electron主进程入口文件，初始化BrowserWindow、注册所有IPC处理器、启动后台服务和插件管理器

## 运行信号

- `ipcMain.handle: preview-list-directory`
- `ipcMain.handle: preview-list-files`
- `ipcMain.handle: sessions:list`
- `ipcMain.handle: slash-commands:list`
- `ipcMain.handle: plugins:getOpenComputerUseStatus`
- `ipcMain.handle: plugins:checkOpenComputerUseUpdate`
- `ipcMain.handle: plugins:installOpenComputerUse`
- `ipcMain.handle: plugins:updateOpenComputerUse`
- `ipcMain.handle: plugins:getFigmaOfficialStatus`
- `ipcMain.handle: plugins:installFigmaOfficial`
- `ipcMain.handle: plugins:connectFigmaOfficial`
- `ipcMain.handle: plugins:connectFigmaCodexOfficial`
- `ipcMain.handle: plugins:connectFigmaPatOfficial`
- `ipcMain.handle: plugins:connectFigmaDesktopOfficial`
- `ipcMain.handle: shell:openExternal`
- `ipcMain.handle: preview-read-file`
- `ipcMain.handle: preview-get-image-base64`
- `ipcMain.handle: preview-get-file-metadata`
- `ipcMain.handle: preview-write-file`
- `ipcMain.handle: preview-remove-entry`
- `ipcMain.handle: preview-rename-entry`
- `ipcMain.handle: preview-open-file`
- `ipcMain.handle: preview-show-item-in-folder`
- `ipcMain.handle: preview-open-dialog`
- `ipcMain.on: client-event`

## 关键符号

- `ipcMain.handle listeners@0 - 注册preview-list-directory、sessions:list、plugins:*、shell:openExternal等30+个IPC通道处理文件操作、插件管理、会话列表等功能`
- `prepareOpenComputerUsePermissions@0 - 准备Open Computer Use插件所需的系统权限`
- `installOpenComputerUsePlugin@0 - 安装Open Computer Use插件`
- `getOpenComputerUsePluginStatus@0 - 获取Open Computer Use插件安装状态和版本`
- `checkOpenComputerUsePluginUpdate@0 - 检查Open Computer Use插件更新`
- `updateOpenComputerUsePlugin@0 - 更新Open Computer Use插件`
- `connectOpenComputerUsePlugin@0 - 连接Open Computer Use MCP服务器`
- `getFigmaOfficialPluginStatus@0 - 获取Figma官方插件状态（OAuth、PAT、Desktop模式）`
- `installFigmaOfficialPlugin@0 - 安装Figma官方插件`
- `connectFigmaDesktopOfficialPlugin@0 - 通过Desktop MCP连接Figma`
- `connectFigmaPatOfficialPlugin@0 - 通过Personal Access Token连接Figma`
- `fetchFigmaPatProfile@0 - 获取Figma PAT对应的用户资料`
- `parseJsonResponse@0 - 解析JSON响应并处理错误详情`
- `getOpenComputerUseVersion@0 - 获取当前安装的Open Computer Use版本号`
- `getOpenComputerUseLatestVersion@0 - 获取Open Computer Use最新版本`
- `getCodexCommand@0 - 获取Codex CLI命令路径`
- `getCodexMcpCredentialsPath@0 - 获取Codex MCP凭证文件路径`

## 依赖输入

- `electron`
- `child_process`
- `crypto`
- `fs`
- `http`
- `os`
- `path`
- `@modelcontextprotocol/sdk/client/index.js`
- `@modelcontextprotocol/sdk/client/auth.js`
- `@modelcontextprotocol/sdk/client/streamableHttp.js`
- `@modelcontextprotocol/sdk/shared/auth.js`
- `./util.js`
- `./pathResolver.js`
- `./test.js`
- `./ipc-handlers.js`
- `./libs/util.js`
- `./libs/config-store.js`
- `./libs/mcp-tools/browser.js`
- `./libs/mcp-tools/design.js`
- `./libs/auto-updater.js`
- `./libs/channel-bridge.js`
- `./libs/system-workspace.js`
- `./libs/claude-settings.js`
- `./libs/image-preprocessor.js`
- `./libs/codex-oauth.js`
- `./libs/agent-rule-docs.js`
- `./libs/skill-manager/ipc-handlers.js`
- `./libs/cron-ipc-handlers.js`
- `./libs/git/index.js`
- `./libs/knowledge/knowledge-ui-store.js`
- `./libs/cron-service.js`
- `./libs/cron-repository.js`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import {
    app,
    BrowserWindow,
    clipboard,
    dialog,
    globalShortcut,
    IpcMainEvent,
    IpcMainInvokeEvent,
    ipcMain,
    Menu,
    nativeImage,
    shell,
    systemPreferences,
    desktopCapturer,
    type MessageBoxOptions,
} from "electron"
import { execSync, spawn } from "child_process";
import { randomUUID } from "crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from "fs";
import { createServer, type Server } from "http";
import { homedir } from "os";
import { extname, isAbsolute, join, relative } from "path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { UnauthorizedError, type OAuthClientProvider, type OAuthDiscoveryState } from "@modelcontextprotocol/sdk/client/auth.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { OAuthClientInformationMixed, OAuthClientMetadata, OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js";
import { ipcMainHandle, isDev, DEV_PORT } from "./util.js";
import { getPreloadPath, getUIPath, getIconPath } from "./pathResolver.js";
import { getStaticData, pollResources, stopPolling } from "./test.js";
import { handleClientEvent, sessions, cleanupAllSessions, setChannelReplySender, listStoredSessionsForRenderer, initializeTaskExecutor, initializeNoteRepository } from "./ipc-handlers.js";
import { generateSessionTitle } from "./libs/util.js";
import {
  loadApiConfigSettings,
  type ApiConfigSettings,
  saveApiConfigSettings,
  loadGlobalRuntimeConfig,
  saveGlobalRuntimeConfig,
} from "./libs/config-store.js";
import { setBrowserToolHost } from "./libs/mcp-tools/browser.js";
import { setDesignToolHost } from "./libs/mcp-tools/design.js";
import { appAutoUpdater, type AppUpdateStatus } from "./libs/auto-updater.js";
import { startChannelBridge, type ChannelBridgeController } from "./libs/channel-bridge.js";
import { ensureSystemWorkspace } from "./libs/system-workspace.js";
import { getCurrentApiConfig, getGlobalRuntimeEnvConfig, resolveImagePreprocessApiConfig } from "./libs/claude-settings.js";
import { preprocessImageAttachments } from "./libs/image-preprocessor.js";
import {
    CODEX_OAUTH_BASE_URL,
    buildCodexRequestHeaders,
    buildCodexResponsesRequest,
    createCodexOAuthAuthorizationFlow,
    encodeCodexOAuthCredential,
    exchangeCodexAuthorizationCode,
    extractCodexModelIdsFromCache,
    getCodexResponsesPath,
    mergeCodexModelIds,
    parseCodexAuthorizationInput,
    parseCodexResponsesStream,
    parseCodexOAuthCredential,
    refreshCodexOAuthToken,
    toAnthropicMessageResponse,
    tokenResultToCredential,
} from "./libs/codex-oauth.js";
import { loadAgentRuleDocuments, saveUserAgentRuleDocument } from "./libs/agent-rule-docs.js";
import { handleSkillManagerInvoke, registerSkillManagerHandlers } from "./libs/skill-manager/ipc-handlers.js";
import { registerCronIpcHandlers, IpcCronEventEmitter } from "./libs/cron-ipc-handlers.js";
import { handleGitWorkbenchInvoke, registerGitWorkbenchIpcHandlers } from "./libs/git/index.js";
import { handleKnowledgeUiInvoke } from "./libs/knowledge/knowledge-ui-store.js";
import { CronService } from "./libs/cron-service.js";
import { CronRepository } from "./libs/cron-repository.js";
import { CronJobExecutor, CronBusyGuard } from "./libs/cron-executor.js";
import { setCronService } from "./libs/mcp-tools/cron.js";
import type { ClientEvent, PromptAttachment, ServerEvent } from "./types.js";
import { BrowserWorkbenchManager, type BrowserWorkbenchBounds, type BrowserWorkbenchEvent } from "./browser-manager.js";
import { startDevBackendBridge, DEV_BACKEND_BRIDGE_PORT } from "./dev-backend-bridge.js";
import { buildSessionSlashCommandItems } from "./libs/slash-command-catalog.js";
import { prepareExternalCliCommand, runExternalCli } from "./libs/external-cli.js";
import {
  buildFigmaOfficialActionResult,
  buildNextFigmaOfficialCodexAuthRuntimeConfig,
  buildNextFigmaOfficialDesktopRuntimeConfig,
  buildNextFigmaOfficialAuthStateRuntimeConfig,
  buildNextFigmaOfficialPatRuntimeConfig,
  buildNextFigmaOfficialRuntimeConfig,
  FIGMA_
... (truncated)
```
