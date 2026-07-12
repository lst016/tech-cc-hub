# 侧边对话功能实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标：** 在现有右侧活动栏中新增可选的 `侧聊` 页签，让用户在不切换主对话的前提下，新建、选择并继续另一个持久化会话。

**架构：** 会话协议增加带请求关联的后台激活语义，`App.onEvent` 将后台创建结果绑定到发起请求的主对话，状态仓库只阻止后台会话抢占 `activeSessionId`。右栏通过现有加号菜单打开 `sidechat` 可选页签，`SideConversationPanel` 使用显式侧聊会话 ID 发送、停止和处理权限，不复用绑定主会话的 `PromptInput`。

**技术栈：** React 19、TypeScript 5.9、Zustand、Electron IPC、Node test runner、Playwright、Tailwind CSS。

---

## 文件边界

- `src/electron/types.ts`、`src/ui/types.ts`：后台激活和请求关联协议。
- `src/electron/ipc-handlers.ts`：首次状态回传创建元数据。
- `src/ui/store/useAppStore.ts`：后台会话入库但不抢占主会话。
- `src/ui/utils/activity-workspace-tabs.ts`、`src/ui/components/ActivityWorkspaceTabs.tsx`：可选侧聊页签及加号菜单。
- `src/ui/utils/side-conversation.ts`：目标过滤和发送资格纯逻辑。
- `src/ui/components/SideConversationPanel.tsx`：侧聊选择、消息、输入、停止和权限 UI。
- `src/ui/components/ActivityRail.tsx`、`src/ui/App.tsx`：右栏挂载、每个主会话的侧聊状态和创建关联。
- `src/ui/dev-electron-shim.ts`、`scripts/qa/side-conversation-smoke.cjs`：双会话浏览器夹具和隔离证明。

### Task 1：后台会话激活协议

**文件：**
- 新建：`test/electron/side-conversation-background-session.test.ts`
- 修改：`src/electron/types.ts`
- 修改：`src/ui/types.ts`
- 修改：`src/electron/ipc-handlers.ts`
- 修改：`src/ui/store/useAppStore.ts`

- [ ] **Step 1：先写失败测试**

```ts
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("side conversation background session contract", () => {
  it("echoes activation and request id from create and start", () => {
    const source = readFileSync("src/electron/ipc-handlers.ts", "utf8");
    assert.match(source, /activation: event\.payload\.activation/);
    assert.match(source, /clientRequestId: event\.payload\.clientRequestId/);
  });

  it("does not activate a new background session", () => {
    const source = readFileSync("src/ui/store/useAppStore.ts", "utf8");
    assert.match(source, /const shouldActivateNewSession = event\.payload\.activation !== "background"/);
    assert.match(source, /if \(state\.pendingStart && shouldActivateNewSession\)/);
    assert.match(source, /if \(isNewSession && shouldActivateNewSession\)/);
    assert.match(source, /error: event\.payload\.error/);
  });
});
```

- [ ] **Step 2：运行并确认 RED**

```powershell
npm run test:electron:build
node --test dist-test/test/electron/side-conversation-background-session.test.js
```

预期：FAIL，创建状态没有元数据，状态仓库没有后台激活保护。

- [ ] **Step 3：实现最小协议**

两份类型文件增加并复用：

```ts
export type SessionActivation = "foreground" | "background";
type SessionCreateMetadata = { activation?: SessionActivation; clientRequestId?: string };
```

`session.create`、`session.start` payload 合并 `SessionCreateMetadata`，`session.status` 增加相同可选字段。两个首次状态事件加入：

```ts
activation: event.payload.activation,
clientRequestId: event.payload.clientRequestId,
```

`SessionView` 增加可选 `error?: string`。状态仓库加入：

```ts
const shouldActivateNewSession = event.payload.activation !== "background";
if (state.pendingStart && shouldActivateNewSession) {
  get().setActiveSessionId(sessionId);
  set({ pendingStart: false, showStartModal: false });
}
if (isNewSession && shouldActivateNewSession) get().setActiveSessionId(sessionId);
```

同一状态更新对象保存 `error: event.payload.error`，完成状态时清除旧错误，确保侧聊错误可以在对应面板内显示。

- [ ] **Step 4：重复 Step 2，确认 GREEN**

- [ ] **Step 5：按 Lore 协议提交上述五个文件**

### Task 2：可选侧聊页签

**文件：**
- 修改：`test/electron/activity-workspace-tabs.test.ts`
- 修改：`src/ui/utils/activity-workspace-tabs.ts`
- 修改：`src/ui/components/ActivityWorkspaceTabs.tsx`

- [ ] **Step 1：先增加失败测试**

```ts
it("keeps side chat in the plus menu until explicitly opened", () => {
  const hidden = buildActivityWorkspaceTabs({ activeTab: "usage", showBrowserTab: false, showSidechatTab: false }).filter((tab) => tab.visible);
  const visible = buildActivityWorkspaceTabs({ activeTab: "sidechat", showBrowserTab: false, showSidechatTab: true }).filter((tab) => tab.visible);
  assert.equal(hidden.some((tab) => tab.id === "sidechat"), false);
  assert.equal(visible.find((tab) => tab.id === "sidechat")?.label, "侧聊");
  assert.equal(shouldShowCreateSidechatTab(false), true);
  assert.equal(shouldShowCreateSidechatTab(true), false);
});
```

默认加号菜单预期改为 `["sidechat", "git", "terminal"]`。

- [ ] **Step 2：运行并确认 RED**

```powershell
npm run test:electron:build
node --test dist-test/test/electron/activity-workspace-tabs.test.js
```

预期：FAIL，`sidechat` 类型和帮助函数不存在。

- [ ] **Step 3：实现最小页签模型**

```ts
export type ActivityRailTab = "trace" | "usage" | "preview" | "sidechat" | "git" | "terminal" | WorkflowAgentRailTab | PluginRailTab;
export type ActivityOptionalWorkspaceTab = "sidechat" | "git" | "terminal" | PluginRailTab;
export function shouldShowCreateSidechatTab(showSidechatTab: boolean) { return !showSidechatTab; }
```

`buildActivityWorkspaceTabs` 在 Usage 后增加：

```ts
{ id: "sidechat", label: "侧聊", title: "侧边对话", visible: input.showSidechatTab === true, active: input.activeTab === "sidechat" }
```

`buildActivityWorkspaceCreateOptions` 在首位增加：

```ts
input.canCreateSidechatTab ? { id: "sidechat", label: "侧聊", title: "打开侧边对话" } : null
```

`ActivityWorkspaceTabs` 增加 `showSidechatTab`、`onCreateSidechatTab` 和 `onCloseSidechatTab`，分别接入加号菜单和页签关闭按钮。

- [ ] **Step 4：重复 Step 2，确认 GREEN**

- [ ] **Step 5：按 Lore 协议提交三个文件**

### Task 3：侧聊纯逻辑

**文件：**
- 新建：`src/ui/utils/side-conversation.ts`
- 新建：`test/electron/side-conversation-model.test.ts`

- [ ] **Step 1：先写失败测试**

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSideConversationTargets, canSendSideConversationDraft, createSideConversationRequestId } from "../../src/ui/utils/side-conversation.js";

describe("side conversation model", () => {
  it("excludes the primary conversation and sorts the rest by recency", () => {
    const sessions = {
      main: { id: "main", title: "Main", status: "idle", messages: [], permissionRequests: [], hydrated: true, updatedAt: 30 },
      next: { id: "next", title: "Next", status: "completed", messages: [], permissionRequests: [], hydrated: true, updatedAt: 20 },
    } as const;
    assert.deepEqual(buildSideConversationTargets(sessions, "main").map((item) => item.id), ["next"]);
  });

  it("allows only non-empty idle connected sends with a model", () => {
    assert.equal(canSendSideConversationDraft({ draft: " hi ", connected: true, status: "completed", model: "gpt" }), true);
    assert.equal(canSendSideConversationDraft({ draft: "", connected: true, status: "completed", model: "gpt" }), false);
    assert.equal(canSendSideConversationDraft({ draft: "hi", connected: true, status: "running", model: "gpt" }), false);
  });

  it("creates recognizable request ids", () => assert.match(createSideConversationRequestId("main"), /^sidechat:main:/));
});
```

- [ ] **Step 2：运行并确认 RED**

```powershell
npm run test:electron:build
node --test dist-test/test/electron/side-conversation-model.test.js
```

预期：FAIL，模块不存在。

- [ ] **Step 3：实现纯函数**

```ts
export function buildSideConversationTargets(sessions: Record<string, SessionView>, primarySessionId: string) {
  return Object.values(sessions)
    .filter((session) => session.id !== primarySessionId)
    .sort((a, b) => (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0));
}
export function canSendSideConversationDraft(input: { draft: string; connected: boolean; status?: SessionStatus; model?: string }) {
  return input.connected && Boolean(input.draft.trim()) && input.status !== "running" && Boolean(input.model?.trim());
}
export function createSideConversationRequestId(primarySessionId: string) {
  return `sidechat:${primarySessionId}:${crypto.randomUUID()}`;
}
```

- [ ] **Step 4：重复 Step 2，确认 GREEN**

- [ ] **Step 5：按 Lore 协议提交两个文件**

### Task 4：侧聊面板

**文件：**
- 新建：`src/ui/components/SideConversationPanel.tsx`
- 新建：`test/electron/side-conversation-ui-source.test.ts`

- [ ] **Step 1：先写失败的 UI 契约测试**

```ts
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("side conversation panel", () => {
  it("targets every action at sideSessionId", () => {
    const source = readFileSync("src/ui/components/SideConversationPanel.tsx", "utf8");
    assert.match(source, /type: "session\.continue"[\s\S]{0,180}sessionId: sideSessionId/);
    assert.match(source, /type: "session\.stop", payload: \{ sessionId: sideSessionId \}/);
    assert.match(source, /type: "permission\.response"[\s\S]{0,160}sessionId: sideSessionId/);
    assert.doesNotMatch(source, /activeSessionId/);
  });

  it("supports transcript, permission and keyboard send", () => {
    const source = readFileSync("src/ui/components/SideConversationPanel.tsx", "utf8");
    assert.match(source, /aria-label="选择侧聊会话"/);
    assert.match(source, /aria-label="输入侧聊消息"/);
    assert.match(source, /event\.key === "Enter" && !event\.shiftKey/);
    assert.match(source, /<ChatTranscript/);
    assert.match(source, /<DecisionPanel/);
  });
});
```

- [ ] **Step 2：运行并确认 RED**

```powershell
npm run test:electron:build
node --test dist-test/test/electron/side-conversation-ui-source.test.js
```

预期：FAIL，组件不存在。

- [ ] **Step 3：实现组件接口和显式会话事件**

```ts
export type SideConversationPanelProps = {
  primarySessionId: string;
  sideSessionId: string | null;
  connected: boolean;
  partialMessage: string;
  onSelectSession: (sessionId: string | null) => void;
  onCreateSession: () => void;
  onRequestHistory: (sessionId: string) => void;
  sendEvent: (event: ClientEvent) => void;
};
```

发送逻辑固定为：

```ts
sendEvent({ type: "session.continue", payload: {
  sessionId: sideSessionId,
  prompt: draft.trim(),
  runtime: { model, reasoningMode, permissionMode, workflowMode },
} });
```

Enter 且非 Shift、非输入法合成时发送；运行中按钮发送 `session.stop` 且不清空草稿。消息区使用 `ChatTranscript`，流式中的 `partialMessage` 显示在消息区末尾；只有用户已经接近底部时才自动跟随。权限区使用 `DecisionPanel` 并发送 `permission.response` 后调用 `resolvePermissionRequest`。

若 `sideSessionId` 不再存在于未归档 `sessions` 中，组件调用 `onSelectSession(null)` 返回选择状态。空状态明确显示“请选择一个侧聊会话”或“当前没有其他会话”，执行错误显示 `sideSession.error` 并提供切换或重试入口，所有状态都保留 `新建侧聊` 按钮。

- [ ] **Step 4：重复 Step 2，确认 GREEN**

- [ ] **Step 5：按 Lore 协议提交两个文件**

### Task 5：右栏与主应用接线

**文件：**
- 修改：`src/ui/components/ActivityRail.tsx`
- 修改：`src/ui/App.tsx`
- 修改：`test/electron/side-conversation-ui-source.test.ts`

- [ ] **Step 1：先增加失败的接线测试**

```ts
it("correlates background creation without changing the primary session", () => {
  const app = readFileSync("src/ui/App.tsx", "utf8");
  assert.match(app, /pendingSideConversationRequestsRef/);
  assert.match(app, /event\.payload\.activation === "background"/);
  assert.match(app, /pendingSideConversationRequestsRef\.current\.get\(event\.payload\.clientRequestId\)/);
  assert.match(app, /setSideSessionIdByPrimarySessionId/);
  assert.doesNotMatch(app, /setActiveSessionId\(event\.payload\.sessionId\)/);
});
```

- [ ] **Step 2：运行 Task 4 测试并确认 RED**

- [ ] **Step 3：实现每主会话状态与请求关联**

```ts
const pendingSideConversationRequestsRef = useRef(new Map<string, string>());
const [sidechatTabBySessionId, setSidechatTabBySessionId] = useState<Record<string, boolean>>({});
const [sideSessionIdByPrimarySessionId, setSideSessionIdByPrimarySessionId] = useState<Record<string, string>>({});
```

`onEvent` 在 `handleServerEvent` 前匹配后台状态：

```ts
if (event.type === "session.status" && event.payload.activation === "background" && event.payload.clientRequestId) {
  const primaryId = pendingSideConversationRequestsRef.current.get(event.payload.clientRequestId);
  if (primaryId) {
    pendingSideConversationRequestsRef.current.delete(event.payload.clientRequestId);
    setSideSessionIdByPrimarySessionId((current) => ({ ...current, [primaryId]: event.payload.sessionId }));
  }
}
```

新建事件：

```ts
const requestId = createSideConversationRequestId(activeSessionId);
pendingSideConversationRequestsRef.current.set(requestId, activeSessionId);
sendEvent({ type: "session.create", payload: {
  title: "新侧聊", cwd: activeSession?.cwd, allowedTools: "*",
  activation: "background", clientRequestId: requestId,
} });
```

打开侧聊时写入 `sidechatTabBySessionId` 并切换 `sidechat`；关闭时清除页签标记，若正在显示则回退 `usage`，但保留目标映射。

- [ ] **Step 4：挂载 ActivityRail 正文**

`ActivityRail` 增加 `hasSidechatTab`、`sideConversationProps`、打开和关闭回调并转发给页签组件；当 `selectedTab === "sidechat"` 时渲染：

```tsx
<SideConversationPanel {...sideConversationProps} />
```

- [ ] **Step 5：运行聚焦测试并确认 GREEN**

```powershell
npm run test:electron:build
node --test dist-test/test/electron/side-conversation-background-session.test.js dist-test/test/electron/side-conversation-model.test.js dist-test/test/electron/side-conversation-ui-source.test.js dist-test/test/electron/activity-workspace-tabs.test.js
```

- [ ] **Step 6：按 Lore 协议提交三个文件**

### Task 6：浏览器 QA 与 80 分验收

**文件：**
- 修改：`src/ui/dev-electron-shim.ts`
- 新建：`scripts/qa/side-conversation-smoke.cjs`
- 修改：`package.json`

- [ ] **Step 1：先写浏览器烟测**

脚本打开 `/?qaSideConversation=1`，通过“添加工作区标签”打开侧聊，选择 `qa-side-secondary`，发送“只回复 SIDE_OK”，断言侧聊出现 `SIDE_OK`，并断言带 `data-active-session-title` 的主标题发送前后完全一致。

```js
await page.getByRole("button", { name: "添加工作区标签" }).click();
await page.getByRole("menuitem", { name: /侧聊/ }).click();
await page.getByLabel("选择侧聊会话").selectOption("qa-side-secondary");
const primaryTitle = await page.locator("[data-active-session-title]").textContent();
await page.getByLabel("输入侧聊消息").fill("只回复 SIDE_OK");
await page.getByLabel("输入侧聊消息").press("Enter");
await expect(page.getByRole("region", { name: "侧聊消息" })).toContainText("SIDE_OK");
await expect(page.locator("[data-active-session-title]")).toHaveText(primaryTitle ?? "");
```

- [ ] **Step 2：运行 `npm run qa:side-conversation` 并确认 RED**

预期：FAIL，夹具或 UI 入口缺失。

- [ ] **Step 3：实现双会话开发夹具**

`qaSideConversation=1` 时 `session.list` 返回 `qa-side-primary` 和 `qa-side-secondary`；`session.history` 按请求 ID 返回独立历史；`session.continue` 只更新 payload 指定会话并追加 `SIDE_OK`；`session.create` 回传相同 `activation` 和 `clientRequestId`。

- [ ] **Step 4：重复 Step 2，确认 GREEN 并生成 `tmp/qa/side-conversation.png`**

- [ ] **Step 5：运行最终验证矩阵**

```powershell
npm run test:electron:build
node --test dist-test/test/electron/side-conversation-background-session.test.js dist-test/test/electron/side-conversation-model.test.js dist-test/test/electron/side-conversation-ui-source.test.js dist-test/test/electron/activity-workspace-tabs.test.js
npx eslint src/ui/App.tsx src/ui/components/ActivityRail.tsx src/ui/components/ActivityWorkspaceTabs.tsx src/ui/components/SideConversationPanel.tsx src/ui/utils/activity-workspace-tabs.ts src/ui/utils/side-conversation.ts src/ui/store/useAppStore.ts src/ui/types.ts src/electron/types.ts src/electron/ipc-handlers.ts test/electron/side-conversation-background-session.test.ts test/electron/side-conversation-model.test.ts test/electron/side-conversation-ui-source.test.ts
npm run build
npm run qa:side-conversation
git diff --check
```

预期：全部退出码为 0。评分为功能与隔离 40、后台激活与持久化 20、交互与恢复 15、自动化覆盖 15、代码质量 10；低于 80 分不得结束。

- [ ] **Step 6：按 Lore 协议提交 QA 三个文件**
