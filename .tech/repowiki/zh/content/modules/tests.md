# tests

> 负责 24 个文件组成的 tests 功能域。

tests 模块包含 24 个被扫描文件，关键入口包括 `test/electron/activity-rail-model.test.ts`, `test/electron/codex-oauth-provider.test.ts`, `test/electron/tsconfig.json`, `test/electron/activity-rail-dual-steps.test.ts`, `test/electron/runner-status.test.ts`, `test/electron/runner-attachments.test.ts`, `test/electron/tool-output-sanitizer.test.ts`, `test/electron/preview-file-refresh.test.ts`。

本地静态分析识别到这些代码信号：event, config, store，因此本页可以作为后续 Agent 定位接口、存储、事件和运行入口的索引。

## Agent 可用信息

- 定位 tests 模块的入口、数据契约和运行风险。
- 在模型没有稳定返回 JSON 时，本页仍由本地代码信号生成，不能再退化为空白说明。

## 优先入口

- `test/electron/activity-rail-model.test.ts`：代码信号：event:assistant, event:tool_use, event:user, event:tool_result, event:user_prompt, event:text, event:message, event:system；关键符号：`ledger`, `ledger`, `model`, `model`, `lifecycleItems`, `model`
- `test/electron/codex-oauth-provider.test.ts`：代码信号：event:codex, event:text, event:tool_use, event:tool_result, event:object, event:string, event:message, event:output_text；关键符号：`profile`, `normalized`, `cachedModels`, `mergedModels`, `request`, `functionCall`
- `test/electron/tsconfig.json`：配置文件，会影响构建、开发或模型能力；代码信号：config:test/electron/tsconfig.json
- `test/electron/activity-rail-dual-steps.test.ts`：代码信号：event:user_prompt, event:assistant, event:message, event:text, event:tool_use, event:user, event:tool_result；关键符号：`model`, `model`, `model`
- `test/electron/runner-status.test.ts`：代码信号：event:result, event:success, event:error_max_turns, event:assistant
- `test/electron/runner-attachments.test.ts`：代码信号：event:text, event:image, event:base64；关键符号：`attachmentPriorityContext`, `promptAfterAttachments`, `contentBlocks`, `contentBlocks`
- `test/electron/tool-output-sanitizer.test.ts`：代码信号：event:text, event:image, event:base64, event:user, event:tool_result；关键符号：`image`, `sanitized`, `toolResult`, `output`
- `test/electron/preview-file-refresh.test.ts`：代码信号：event:assistant, event:tool_use, event:user, event:tool_result；关键符号：`messages`, `messages`

## 文件

### `test/electron/activity-rail-model.test.ts`

代码信号：event:assistant, event:tool_use, event:user, event:tool_result, event:user_prompt, event:text, event:message, event:system；关键符号：`ledger`, `ledger`, `model`, `model`, `lifecycleItems`, `model`

- `ledger` (const) - const ledger = buildPromptLedgerMessage({
- `ledger` (const) - const ledger = buildPromptLedgerMessage({
- `model` (const) - const model = buildActivityRailModel(
- `model` (const) - const model = buildActivityRailModel(
- `lifecycleItems` (const) - const lifecycleItems = model.timeline.filter((item) => item.nodeKind === "lifecycle");
- `model` (const) - const model = buildActivityRailModel(
- `distributionLabels` (const) - const distributionLabels = model.contextDistribution.buckets.map((bucket) => bucket.label);
- `promptText` (const) - const promptText = model.contextSnapshot.latestPrompt ?? "";
- `planText` (const) - const planText = model.taskSteps.map((step, index) => `${index + 1}. ${step.title}`).join("\n");
- `expectedSummaryContext` (const) - const expectedSummaryContext =
- `readItem` (const) - const readItem = model.timeline.find((item) => item.id === "tool-read");
- `promptBucket` (const) - const promptBucket = model.contextDistribution.buckets.find((bucket) => bucket.id === "user-prompt");

### `test/electron/codex-oauth-provider.test.ts`

代码信号：event:codex, event:text, event:tool_use, event:tool_result, event:object, event:string, event:message, event:output_text；关键符号：`profile`, `normalized`, `cachedModels`, `mergedModels`, `request`, `functionCall`

- `profile` (const) - const profile = createCodexOAuthProfile();
- `normalized` (const) - const normalized = normalizeProfile({
- `cachedModels` (const) - const cachedModels = extractCodexModelIdsFromCache({
- `mergedModels` (const) - const mergedModels = mergeCodexModelIds([...cachedModels, "gpt-5.4-mini-openai-compact"]);
- `request` (const) - const request = buildCodexResponsesRequest({
- `functionCall` (const) - const functionCall = request.input.find((item) => item.type === "function_call");
- `functionOutput` (const) - const functionOutput = request.input.find((item) => item.type === "function_call_output");
- `response` (const) - const response = toAnthropicMessageResponse({
- `stream` (const) - const stream = buildSyntheticAnthropicStream(response);
- `response` (const) - const response = parseCodexResponsesStream([
- `message` (const) - const message = toAnthropicMessageResponse(response, "gpt-5.4");
- `source` (const) - const source = readFileSync("src/ui/components/settings/ApiProfilesSettingsPage.tsx", "utf8");

### `test/electron/tsconfig.json`

配置文件，会影响构建、开发或模型能力；代码信号：config:test/electron/tsconfig.json

### `test/electron/activity-rail-dual-steps.test.ts`

代码信号：event:user_prompt, event:assistant, event:message, event:text, event:tool_use, event:user, event:tool_result；关键符号：`model`, `model`, `model`

- `model` (const) - const model = buildActivityRailModel(
- `model` (const) - const model = buildActivityRailModel(
- `model` (const) - const model = buildActivityRailModel(

### `test/electron/runner-status.test.ts`

代码信号：event:result, event:success, event:error_max_turns, event:assistant

### `test/electron/runner-attachments.test.ts`

代码信号：event:text, event:image, event:base64；关键符号：`attachmentPriorityContext`, `promptAfterAttachments`, `contentBlocks`, `contentBlocks`

- `attachmentPriorityContext` (const) - const attachmentPriorityContext = [
- `promptAfterAttachments` (const) - const promptAfterAttachments = (prompt: string) => `User request after reading the attachments first:\n${prompt}`;
- `contentBlocks` (const) - const contentBlocks = buildAnthropicPromptContentBlocks("describe this image", [
- `contentBlocks` (const) - const contentBlocks = buildAnthropicPromptContentBlocks("use this screenshot", [

### `test/electron/tool-output-sanitizer.test.ts`

代码信号：event:text, event:image, event:base64, event:user, event:tool_result；关键符号：`image`, `sanitized`, `toolResult`, `output`

- `image` (const) - const image = extractInlineBase64ImageFromToolResponse({
- `sanitized` (const) - const sanitized = stripInlineBase64ImagesFromMessage({
- `toolResult` (const) - const toolResult = (sanitized as unknown as {
- `output` (const) - const output = buildOversizedTextToolOutputReplacement("Read", {

### `test/electron/preview-file-refresh.test.ts`

代码信号：event:assistant, event:tool_use, event:user, event:tool_result；关键符号：`messages`, `messages`

- `messages` (const) - const messages = [
- `messages` (const) - const messages = [

### `test/electron/slash-commands.test.ts`

代码信号：event:system, event:init, event:assistant, event:message；关键符号：`sandboxRoot`, `userRoot`, `projectRoot`, `commands`, `sandboxRoot`, `projectRoot`

- `sandboxRoot` (const) - const sandboxRoot = mkdtempSync(join(tmpdir(), "slash-commands-"));
- `userRoot` (const) - const userRoot = join(sandboxRoot, "user");
- `projectRoot` (const) - const projectRoot = join(sandboxRoot, "project");
- `commands` (const) - const commands = discoverSlashCommandsInRoots({
- `sandboxRoot` (const) - const sandboxRoot = mkdtempSync(join(tmpdir(), "slash-commands-"));
- `projectRoot` (const) - const projectRoot = join(sandboxRoot, "project");
- `commands` (const) - const commands = mergeSlashCommandLists(
- `sandboxRoot` (const) - const sandboxRoot = mkdtempSync(join(tmpdir(), "slash-commands-"));
- `projectRoot` (const) - const projectRoot = join(sandboxRoot, "project");
- `first` (const) - const first = discoverSlashCommandItemsInRoots({ project: projectRoot });
- `second` (const) - const second = discoverSlashCommandItemsInRoots({ project: projectRoot });
- `commands` (const) - const commands = extractSlashCommandsFromMessages([

### `test/electron/builtin-mcp-registry.test.ts`

关键符号：`serverInfos`, `registryNames`, `toolNames`, `uniqueToolNames`, `hints`

- `serverInfos` (const) - const serverInfos = listBuiltinMcpServerInfos();
- `registryNames` (const) - const registryNames = BUILTIN_MCP_SERVERS.map((server) => server.name);
- `toolNames` (const) - const toolNames = listBuiltinMcpToolNames();
- `uniqueToolNames` (const) - const uniqueToolNames = new Set(toolNames);
- `hints` (const) - const hints = buildBuiltinMcpPromptHints();

### `test/electron/figma-official-plugin.test.ts`

代码信号：event:http, event:stdio, event:codex-supported-client-oauth；关键符号：`next`, `configured`, `misconfigured`, `next`, `figmaPlugin`, `status`

- `next` (const) - const next = buildNextFigmaOfficialRuntimeConfig({
- `configured` (const) - const configured = {
- `misconfigured` (const) - const misconfigured = {
- `next` (const) - const next = buildNextFigmaOfficialDesktopRuntimeConfig({
- `figmaPlugin` (const) - const figmaPlugin = (next.plugins as Record<string, Record<string, unknown>>)["figma-official"];
- `status` (const) - const status = getFigmaOfficialPluginStatusFromConfig(next);
- `next` (const) - const next = buildNextFigmaOfficialDesktopRuntimeConfig({}, {
- `status` (const) - const status = getFigmaOfficialPluginStatusFromConfig(next);
- `status` (const) - const status = getFigmaOfficialPluginStatusFromConfig({
- `next` (const) - const next = buildNextFigmaOfficialAuthStateRuntimeConfig({
- `figmaPlugin` (const) - const figmaPlugin = (next.plugins as Record<string, Record<string, unknown>>)["figma-official"];
- `oauth` (const) - const oauth = parseFigmaCodexOAuthCredentialStore({

### `test/electron/runner-claude-code-plugins.test.ts`

关键符号：`source`, `source`, `source`

- `source` (const) - const source = readFileSync("src/electron/libs/runner.ts", "utf8");
- `source` (const) - const source = readFileSync("src/electron/libs/runner.ts", "utf8");
- `source` (const) - const source = readFileSync("src/electron/libs/runner.ts", "utf8");

### `test/electron/runner-error.test.ts`

关键符号：`message`, `message`, `message`

- `message` (const) - const message = normalizeRunnerError(
- `message` (const) - const message = normalizeRunnerError(new Error("socket hang up"), "claude-sonnet-4-5");
- `message` (const) - const message = normalizeRunnerError(

### `test/electron/stateless-continuation-image-summary.test.ts`

代码信号：event:user_prompt, event:result, event:success；关键符号：`prompt`

- `prompt` (const) - const prompt = buildStatelessContinuationPrompt(

### `test/electron/stateless-continuation.test.ts`

代码信号：event:user_prompt, event:result, event:success；关键符号：`prompt`, `longChunk`, `messages`, `round`, `prompt`, `messages`

- `prompt` (const) - const prompt = buildStatelessContinuationPrompt(
- `longChunk` (const) - const longChunk = "连续上下文".repeat(10_000);
- `messages` (const) - const messages = Array.from({ length: 6 }, (_, index) => {
- `round` (const) - const round = index + 1;
- `prompt` (const) - const prompt = buildStatelessContinuationPrompt(messages, "继续");
- `messages` (const) - const messages = Array.from({ length: 4 }, (_, index) => {
- `round` (const) - const round = index + 1;
- `prompt` (const) - const prompt = buildStatelessContinuationPrompt(
- `messages` (const) - const messages = Array.from({ length: 6 }, (_, index) => {
- `round` (const) - const round = index + 1;
- `prompt` (const) - const prompt = buildStatelessContinuationPrompt(
- `prompt` (const) - const prompt = buildStatelessContinuationPrompt(

### `test/electron/task-repository.test.ts`

关键符号：`createRepo`, `createTask`, `repo`, `task`, `execution`, `stored`

- `createRepo` (function) - function createRepo(): TaskRepository {
- `createTask` (function) - function createTask(overrides: Partial<ExternalTask> = {}): ExternalTask {
- `repo` (const) - const repo = createRepo();
- `task` (const) - const task = repo.upsertTask(createTask());
- `execution` (const) - const execution = repo.createExecution({
- `stored` (const) - const stored = repo.getTask(task.id);
- `bundle` (const) - const bundle = repo.getExecutionBundle(task.id);
- `repo` (const) - const repo = createRepo();
- `task` (const) - const task = repo.upsertTask(createTask({ externalId: "ext-2" }));
- `retrying` (const) - const retrying = repo.scheduleRetry(task.id, 1, Date.now() + 1000, "临时失败");
- `failed` (const) - const failed = repo.cancelRetry(task.id, "用户取消自动重试");
- `recovered` (const) - const recovered = repo.recoverInterruptedExecutions("应用重启");

### `test/electron/attachments.test.ts`

代码信号：event:user_prompt, store:attachments.test；关键符号：`attachments`, `src`, `src`, `chars`

- `attachments` (const) - const attachments = [
- `src` (const) - const src = resolveImageAttachmentSrc({
- `src` (const) - const src = resolveImageAttachmentSrc({
- `chars` (const) - const chars = estimateAttachmentPromptChars({

### `test/electron/claude-code-plugins.test.ts`

代码信号：event:http, event:local；关键符号：`claudeRoot`, `pluginPath`, `agentBridgePath`, `plugins`, `claudeRoot`, `pluginPath`

- `claudeRoot` (const) - const claudeRoot = mkdtempSync(join(tmpdir(), "tech-cc-hub-claude-plugin-"));
- `pluginPath` (const) - const pluginPath = join(claudeRoot, "plugins", "cache", "claude-plugins-official", "figma", "2.1.30");
- `agentBridgePath` (const) - const agentBridgePath = join(claudeRoot, "plugins", "cache", "agentbridge", "agentbridge", "0.1.0");
- `plugins` (const) - const plugins = resolveEnabledClaudeCodeSdkPlugins({ claudeRoot });
- `claudeRoot` (const) - const claudeRoot = mkdtempSync(join(tmpdir(), "tech-cc-hub-claude-plugin-disabled-"));
- `pluginPath` (const) - const pluginPath = join(claudeRoot, "plugins", "cache", "claude-plugins-official", "figma", "2.1.30");

### `test/electron/code-reference-prompt.test.ts`

代码信号：event:code_references, event:code_comment；关键符号：`prompt`

- `prompt` (const) - const prompt = [

### `test/electron/external-mcp-servers.test.ts`

代码信号：event:stdio, event:http；关键符号：`config`, `parsed`, `infos`, `parsed`, `config`, `infos`

- `config` (const) - const config = {
- `parsed` (const) - const parsed = parseExternalMcpServers(config);
- `infos` (const) - const infos = listExternalMcpServerInfos(config);
- `parsed` (const) - const parsed = parseExternalMcpServers(
- `config` (const) - const config = {
- `infos` (const) - const infos = listExternalMcpServerInfos(config);
- `config` (const) - const config = { mcpServers: { figma: { type: "http", url: "https://mcp.figma.com/mcp" } } };

### `test/electron/prompt-ledger-storage.test.ts`

代码信号：event:user, event:tool_result；关键符号：`message`, `toolSegment`

- `message` (const) - const message = buildPromptLedgerMessage({
- `toolSegment` (const) - const toolSegment = message.segments.find((segment) => segment.segmentKind === "history_tool_output");

### `test/electron/design-inspection-dsl.test.ts`

代码信号：event:button；关键符号：`prompt`, `dsl`, `dsl`

- `prompt` (const) - const prompt = buildDesignInspectionPrompt("分析弹窗");
- `dsl` (const) - const dsl = parseDesignInspectionDsl([
- `dsl` (const) - const dsl = parseDesignInspectionDsl("弹窗为链接/二维码模态框，底部有关闭和下载二维码按钮。");

### `test/electron/external-cli.test.ts`

代码信号：event:my_tasks；关键符号：`tempDir`, `scriptPath`, `shimPath`, `params`, `tempDir`, `scriptPath`

- `tempDir` (const) - const tempDir = mkdtempSync(join(tmpdir(), "tech-cc-hub-cli-"));
- `scriptPath` (const) - const scriptPath = join(tempDir, "fake-cli.cjs");
- `shimPath` (const) - const shimPath = join(tempDir, "fake-cli.cmd");
- `params` (const) - const params = JSON.stringify({ type: "my_tasks", completed: false, page_size: 100 });
- `tempDir` (const) - const tempDir = mkdtempSync(join(tmpdir(), "tech-cc-hub-cli-"));
- `scriptPath` (const) - const scriptPath = join(tempDir, "fake-npm.cjs");
- `shimPath` (const) - const shimPath = join(tempDir, "fake-npm.cmd");
- `tempRoot` (const) - const tempRoot = mkdtempSync(join(tmpdir(), "tech-cc-hub cli-"));
- `tempDir` (const) - const tempDir = join(tempRoot, "Program Files", "Volta");
- `scriptPath` (const) - const scriptPath = join(tempDir, "npm.cjs");
- `shimPath` (const) - const shimPath = join(tempDir, "npm.cmd");

### `test/electron/activity-workspace-tabs.test.ts`

关键符号：`visibleTabs`, `visibleTabs`, `appSource`, `railSource`, `appSource`

- `visibleTabs` (const) - const visibleTabs = buildActivityWorkspaceTabs({
- `visibleTabs` (const) - const visibleTabs = buildActivityWorkspaceTabs({
- `appSource` (const) - const appSource = readFileSync("src/ui/App.tsx", "utf8");
- `railSource` (const) - const railSource = readFileSync("src/ui/components/ActivityRail.tsx", "utf8");
- `appSource` (const) - const appSource = readFileSync("src/ui/App.tsx", "utf8");

## 数据与接口契约

- **event:assistant**：test/electron/activity-rail-model.test.ts:24 - typed event payload
- **event:tool_use**：test/electron/activity-rail-model.test.ts:30 - typed event payload
- **event:user**：test/electron/activity-rail-model.test.ts:39 - typed event payload
- **event:tool_result**：test/electron/activity-rail-model.test.ts:43 - typed event payload
- **event:user_prompt**：test/electron/activity-rail-model.test.ts:81 - typed event payload
- **event:text**：test/electron/activity-rail-model.test.ts:91 - typed event payload
- **event:message**：test/electron/activity-rail-model.test.ts:117 - typed event payload
- **event:system**：test/electron/activity-rail-model.test.ts:177 - typed event payload
- **event:init**：test/electron/activity-rail-model.test.ts:178 - typed event payload
- **event:result**：test/electron/activity-rail-model.test.ts:185 - typed event payload
- **event:codex**：test/electron/codex-oauth-provider.test.ts:75 - typed event payload
- **event:text**：test/electron/codex-oauth-provider.test.ts:104 - typed event payload
- **event:tool_use**：test/electron/codex-oauth-provider.test.ts:105 - typed event payload
- **event:tool_result**：test/electron/codex-oauth-provider.test.ts:111 - typed event payload
- **event:object**：test/electron/codex-oauth-provider.test.ts:120 - typed event payload
- **event:string**：test/electron/codex-oauth-provider.test.ts:121 - typed event payload
- **event:message**：test/electron/codex-oauth-provider.test.ts:147 - typed event payload
- **event:output_text**：test/electron/codex-oauth-provider.test.ts:149 - typed event payload
- **event:function_call**：test/electron/codex-oauth-provider.test.ts:153 - typed event payload
- **event:user_prompt**：test/electron/activity-rail-dual-steps.test.ts:14 - typed event payload
- **event:assistant**：test/electron/activity-rail-dual-steps.test.ts:18 - typed event payload
- **event:message**：test/electron/activity-rail-dual-steps.test.ts:27 - typed event payload
- **event:text**：test/electron/activity-rail-dual-steps.test.ts:30 - typed event payload
- **event:tool_use**：test/electron/activity-rail-dual-steps.test.ts:56 - typed event payload
- **event:user**：test/electron/activity-rail-dual-steps.test.ts:69 - typed event payload
- **event:tool_result**：test/electron/activity-rail-dual-steps.test.ts:77 - typed event payload
- **event:result**：test/electron/runner-status.test.ts:10 - typed event payload
- **event:success**：test/electron/runner-status.test.ts:10 - typed event payload
- **event:error_max_turns**：test/electron/runner-status.test.ts:11 - typed event payload
- **event:assistant**：test/electron/runner-status.test.ts:12 - typed event payload
- **event:text**：test/electron/runner-attachments.test.ts:33 - typed event payload
- **event:image**：test/electron/runner-attachments.test.ts:37 - typed event payload
- **event:base64**：test/electron/runner-attachments.test.ts:39 - typed event payload
- **event:text**：test/electron/tool-output-sanitizer.test.ts:13 - typed event payload
- **event:image**：test/electron/tool-output-sanitizer.test.ts:22 - typed event payload
- **event:base64**：test/electron/tool-output-sanitizer.test.ts:24 - typed event payload

## 关键概念

- **event**：tests 模块中出现 67 个 event 信号，可用于定位对应接口或运行职责。
- **config**：tests 模块中出现 1 个 config 信号，可用于定位对应接口或运行职责。
- **store**：tests 模块中出现 1 个 store 信号，可用于定位对应接口或运行职责。

## 内部关系

- `test/electron/activity-rail-model.test.ts` -> `../../src/shared/activity-rail-model.js`：本地相对依赖，需要按路径解析到目标文件
- `test/electron/activity-rail-model.test.ts` -> `../../src/shared/prompt-ledger.js`：本地相对依赖，需要按路径解析到目标文件
- `test/electron/codex-oauth-provider.test.ts` -> `../../src/electron/libs/codex-oauth.js`：本地相对依赖，需要按路径解析到目标文件
- `test/electron/codex-oauth-provider.test.ts` -> `../../src/ui/components/settings/settings-utils.js`：本地相对依赖，需要按路径解析到目标文件
- `test/electron/codex-oauth-provider.test.ts` -> `../../src/shared/model-provider-routing.js`：本地相对依赖，需要按路径解析到目标文件
- `test/electron/activity-rail-dual-steps.test.ts` -> `../../src/shared/activity-rail-model.js`：本地相对依赖，需要按路径解析到目标文件
- `test/electron/runner-status.test.ts` -> `../../src/shared/runner-status.js`：本地相对依赖，需要按路径解析到目标文件
- `test/electron/runner-attachments.test.ts` -> `../../src/shared/runner-prompt.js`：本地相对依赖，需要按路径解析到目标文件
- `test/electron/runner-attachments.test.ts` -> `../../src/shared/attachments.js`：本地相对依赖，需要按路径解析到目标文件
- `test/electron/tool-output-sanitizer.test.ts` -> `../../src/electron/libs/tool-output-sanitizer.js`：本地相对依赖，需要按路径解析到目标文件
- `test/electron/preview-file-refresh.test.ts` -> `../../src/ui/utils/preview-file-refresh.js`：本地相对依赖，需要按路径解析到目标文件
- `test/electron/slash-commands.test.ts` -> `../../src/electron/libs/slash-command-discovery.js`：本地相对依赖，需要按路径解析到目标文件
- `test/electron/slash-commands.test.ts` -> `../../src/shared/slash-commands.js`：本地相对依赖，需要按路径解析到目标文件
- `test/electron/builtin-mcp-registry.test.ts` -> `../../src/shared/builtin-mcp-registry.js`：本地相对依赖，需要按路径解析到目标文件
- `test/electron/figma-official-plugin.test.ts` -> `../../src/electron/libs/figma-official-plugin.js`：本地相对依赖，需要按路径解析到目标文件
- `test/electron/runner-error.test.ts` -> `../../src/electron/libs/runner-error.js`：本地相对依赖，需要按路径解析到目标文件
- `test/electron/stateless-continuation-image-summary.test.ts` -> `../../src/electron/stateless-continuation.js`：本地相对依赖，需要按路径解析到目标文件
- `test/electron/stateless-continuation.test.ts` -> `../../src/electron/stateless-continuation.js`：本地相对依赖，需要按路径解析到目标文件
- `test/electron/task-repository.test.ts` -> `../../src/electron/libs/task/repository.js`：本地相对依赖，需要按路径解析到目标文件
- `test/electron/task-repository.test.ts` -> `../../src/electron/libs/task/types.js`：本地相对依赖，需要按路径解析到目标文件
- `test/electron/attachments.test.ts` -> `../../src/shared/attachments.js`：本地相对依赖，需要按路径解析到目标文件
- `test/electron/claude-code-plugins.test.ts` -> `../../src/electron/libs/claude-code-plugins.js`：本地相对依赖，需要按路径解析到目标文件
- `test/electron/code-reference-prompt.test.ts` -> `../../src/ui/utils/code-reference-prompt.js`：本地相对依赖，需要按路径解析到目标文件
- `test/electron/external-mcp-servers.test.ts` -> `../../src/electron/libs/external-mcp-servers.js`：本地相对依赖，需要按路径解析到目标文件
- `test/electron/prompt-ledger-storage.test.ts` -> `../../src/shared/prompt-ledger.js`：本地相对依赖，需要按路径解析到目标文件
- `test/electron/design-inspection-dsl.test.ts` -> `../../src/electron/libs/design-inspection-dsl.js`：本地相对依赖，需要按路径解析到目标文件
- `test/electron/external-cli.test.ts` -> `../../src/electron/libs/external-cli.js`：本地相对依赖，需要按路径解析到目标文件
- `test/electron/activity-workspace-tabs.test.ts` -> `../../src/ui/utils/activity-workspace-tabs.js`：本地相对依赖，需要按路径解析到目标文件

## 修改风险

- runner prompt 拼装顺序改变会影响所有新会话的工具、规则和知识库可见性。

## 验证

- npm run transpile:electron
- npm run build
