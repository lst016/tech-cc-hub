# 临时多线程 BTW 侧聊 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在右侧 Activity Rail 实现不持久化、创建时快照、支持完整工具和多线程多轮追问的 BTW 侧聊，同时保持主输入框与侧聊输入框完全分离并同时可见。

**Architecture:** 主进程使用独立的内存 `BtwRuntimeManager`，把普通 Runner 事件转换为 `btw.*` 事件，永不调用普通会话的创建、更新或消息持久化。Renderer 使用独立 `useBtwStore` 保存线程、消息和 Composer 状态；现有 `PromptInput` 接受可选 controller，从而复用同一套 Composer 视图但绑定不同状态与发送协议。

**Tech Stack:** Electron IPC、TypeScript、React 19、Zustand 5、Node test runner、Playwright/Vite dev shim。

---

### Task 1: 锁定 BTW 协议和 Runtime 隔离契约

**Files:**
- Modify: `src/electron/types.ts`
- Modify: `src/ui/types.ts`
- Replace: `test/electron/side-conversation-background-session.test.ts`

- [ ] **Step 1: 写失败的协议测试**

测试必须断言 ClientEvent 包含 `btw.thread.create/send/stop/permission.response/close` 和 `btw.parent.close_all`，ServerEvent 包含 created/status/stream/user_prompt/permission/error/closed，并继续禁止 background 普通 session。

```ts
it("declares a dedicated ephemeral btw protocol", () => {
  for (const path of ["src/electron/types.ts", "src/ui/types.ts"]) {
    const source = readFileSync(path, "utf8");
    for (const type of [
      "btw.thread.create", "btw.thread.send", "btw.thread.stop",
      "btw.thread.permission.response", "btw.thread.close", "btw.parent.close_all",
      "btw.thread.created", "btw.thread.status", "btw.stream.message",
      "btw.stream.user_prompt", "btw.permission.request", "btw.runner.error",
      "btw.thread.closed", "btw.parent.closed",
    ]) assert.match(source, new RegExp(type.replaceAll(".", "\\\\.")));
    assert.doesNotMatch(source, /SessionActivation|activation:\s*"background"/);
  }
});
```

- [ ] **Step 2: 运行并确认 RED**

Run: `npm run test:electron:build && node --test dist-test/test/electron/side-conversation-background-session.test.js`

Expected: FAIL，提示缺少 `btw.thread.create`。

- [ ] **Step 3: 添加最小类型契约**

两个事件联合类型采用相同字段：

```ts
| { type: "btw.thread.create"; payload: { parentSessionId: string } }
| { type: "btw.thread.send"; payload: { threadId: string; prompt: string; agentPrompt?: string; workspaceContext?: LinkedWorkspaceContext; attachments?: PromptAttachment[]; runtime?: RuntimeOverrides } }
| { type: "btw.thread.stop"; payload: { threadId: string } }
| { type: "btw.thread.permission.response"; payload: { threadId: string; toolUseId: string; result: PermissionResult } }
| { type: "btw.thread.close"; payload: { threadId: string } }
| { type: "btw.parent.close_all"; payload: { parentSessionId: string } }
```

Server payload 始终携带 `threadId`，created/parent.closed 额外携带 `parentSessionId`。

- [ ] **Step 4: 运行并确认 GREEN**

Run: `npm run test:electron:build && node --test dist-test/test/electron/side-conversation-background-session.test.js`

Expected: PASS。

### Task 2: 用 TDD 实现内存 BtwRuntimeManager

**Files:**
- Create: `src/electron/libs/btw-runtime-manager.ts`
- Create: `test/electron/btw-runtime-manager.test.ts`

- [ ] **Step 1: 写多线程、快照和关闭失败测试**

使用依赖注入的 fake runner，覆盖：创建为空、同一父会话多线程、不同创建时刻快照不同、发送只组合固定快照和线程私有历史、工具/权限事件按 threadId 转换、关闭后丢弃迟到事件、stop 只 abort 当前线程、closeParent 清除全部线程。

```ts
const manager = new BtwRuntimeManager({
  run: async (options) => {
    runs.push(options);
    return { abort: () => aborted.push(options.session.id), appendPrompt: async () => {}, stopTask: async () => {}, isClosed: () => false };
  },
  buildContinuation: (messages, prompt) => ({ prompt: JSON.stringify({ messages, prompt }), usedCompression: false, summaryText: "", summaryMessageCount: 0 }),
  emit: (event) => events.push(event),
  createId: () => `btw-${++sequence}`,
  now: () => 1000 + sequence,
});
```

- [ ] **Step 2: 运行并确认 RED**

Run: `npm run test:electron:build && node --test dist-test/test/electron/btw-runtime-manager.test.js`

Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现最小 RuntimeManager**

`BtwRuntimeManager` 保存以下纯内存结构，禁止接收 `SessionStore`：

```ts
type BtwRuntime = {
  threadId: string;
  parentSessionId: string;
  session: Session;
  snapshot: StreamMessage[];
  messages: StreamMessage[];
  handle?: RunnerHandle;
  generation: number;
  createdAt: number;
  updatedAt: number;
};
```

公开方法为 `createThread`、`send`、`stop`、`respondPermission`、`closeThread`、`closeParent`、`closeAll`。`send` 每轮新建 runner，使用 `snapshot + messages` 构造 stateless prompt；Runner 的普通事件通过私有 `routeRunnerEvent` 转换成 `btw.*`，且先检查 thread 仍存在及 generation 相等。

- [ ] **Step 4: 运行并确认 GREEN**

Run: `npm run test:electron:build && node --test dist-test/test/electron/btw-runtime-manager.test.js`

Expected: 所有 RuntimeManager 测试 PASS。

- [ ] **Step 5: 覆盖率检查**

Run: `node --experimental-test-coverage --test dist-test/test/electron/btw-runtime-manager.test.js`

Expected: `btw-runtime-manager.js` line coverage >= 80%。

### Task 3: 接入 Electron 事件分发且不持久化

**Files:**
- Modify: `src/electron/ipc-handlers.ts`
- Modify: `test/electron/side-conversation-background-session.test.ts`

- [ ] **Step 1: 写失败的 IPC 隔离测试**

断言 BTW 分支调用 manager，并且分支文本中不出现 `store.createSession`、`store.updateSession`、`store.addMessage`、`setActiveSessionId`。

```ts
it("routes btw events without ordinary session persistence", () => {
  const source = readFileSync("src/electron/ipc-handlers.ts", "utf8");
  const branch = source.slice(source.indexOf('event.type === "btw.thread.create"'), source.indexOf('event.type === "session.create"'));
  assert.match(branch, /btwRuntimeManager\.createThread/);
  assert.doesNotMatch(branch, /store\.(createSession|updateSession|addMessage)/);
});
```

- [ ] **Step 2: 运行并确认 RED**

Run: `npm run test:electron:build && node --test dist-test/test/electron/side-conversation-background-session.test.js`

Expected: FAIL，缺少 manager 分支。

- [ ] **Step 3: 接入 manager**

`btw.thread.create` 从 `SessionStore` 只读父 session 和完整 history，深拷贝快照后创建内存线程；`btw.thread.send` 复用现有附件准备函数；其他事件直接路由 manager。`session.delete` 先 `closeParent(sessionId)`；`cleanupAllSessions` 调用 `closeAll()`。

- [ ] **Step 4: 运行并确认 GREEN**

Run: `npm run test:electron:build && node --test dist-test/test/electron/side-conversation-background-session.test.js dist-test/test/electron/btw-runtime-manager.test.js`

Expected: PASS。

### Task 4: 用 TDD 实现独立 useBtwStore

**Files:**
- Create: `src/ui/store/useBtwStore.ts`
- Create: `test/electron/btw-store.test.ts`

- [ ] **Step 1: 写失败的 Store 行为测试**

测试真实 store API：created 添加空线程并自动选中；两个线程的消息/草稿/附件/模型互不影响；stream delta 只更新对应 partial；关闭线程清除全部字段并选择相邻线程；parent.closed 清空父会话；普通 `session.*` 事件被忽略。

```ts
const store = createBtwStore();
store.getState().handleServerEvent(created("a", "parent"));
store.getState().setDraft("a", "only-a");
store.getState().handleServerEvent(created("b", "parent"));
assert.equal(store.getState().threads.a.draft, "only-a");
assert.equal(store.getState().threads.b.draft, "");
```

- [ ] **Step 2: 运行并确认 RED**

Run: `npm run test:electron:build && node --test dist-test/test/electron/btw-store.test.js`

Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现 vanilla store + React hook**

导出 `createBtwStore()` 供测试，导出 `useBtwStore` 供 React。状态只在内存，不使用 localStorage/persist middleware；所有 reducer 都先检查 thread 是否存在，以丢弃关闭后的迟到事件。

- [ ] **Step 4: 运行并确认 GREEN 与 80% 覆盖率**

Run: `npm run test:electron:build && node --experimental-test-coverage --test dist-test/test/electron/btw-store.test.js`

Expected: 测试 PASS，`useBtwStore.js` line coverage >= 80%。

### Task 5: 让同一 PromptInput 绑定独立 BTW controller

**Files:**
- Create: `src/ui/components/prompt-input/useBtwPromptController.ts`
- Modify: `src/ui/components/prompt-input/PromptInput.tsx`
- Modify: `src/ui/components/prompt-input/usePromptActions.ts`
- Modify: `test/electron/prompt-input-min-width.test.ts`
- Modify: `test/electron/side-conversation-ui-source.test.ts`

- [ ] **Step 1: 写失败的双 Composer 契约测试**

断言 `PromptInput` 接受 `controller`，BTW controller 发送 `btw.thread.send/stop`，不发送 `session.continue/stop/set_model`；side 模式不读取或写入主 prompt、主引用和持久化 queue。

- [ ] **Step 2: 运行并确认 RED**

Run: `npm run test:electron:build && node --test dist-test/test/electron/prompt-input-min-width.test.js dist-test/test/electron/side-conversation-ui-source.test.js`

Expected: FAIL，缺少 `PromptInputController`。

- [ ] **Step 3: 提取可注入 controller 边界**

```ts
export type PromptInputController = {
  scope: "session" | "btw";
  id: string | null;
  prompt: string;
  setPrompt: (value: string) => void;
  attachments: PromptAttachment[];
  setAttachments: (value: PromptAttachment[]) => void;
  cwd: string;
  model: string;
  reasoningMode: RuntimeReasoningMode;
  isRunning: boolean;
  error?: string;
  sendPromptDraft: (prompt: string, attachments: PromptAttachment[]) => Promise<boolean>;
  stop: () => void;
  setModel: (model: string) => void;
  setReasoningMode: (mode: RuntimeReasoningMode) => void;
  setError: (message: string | null) => void;
};
```

未传 controller 时维持普通会话行为；传入 BTW controller 时，草稿、附件、模型、reasoning、错误、发送和停止全部走 `useBtwStore`。BTW queue 保持组件内存且不写 localStorage；主 Composer 继续沿用原逻辑。

- [ ] **Step 4: 实现 BTW controller**

`useBtwPromptController(threadId, sendEvent)` 从 `useBtwStore` 读写线程状态，构造完整 runtime，并发送 `btw.thread.send`。附件继续使用原 PromptInput 的选择、拖拽和粘贴 UI。

- [ ] **Step 5: 运行并确认 GREEN**

Run: `npm run test:electron:build && node --test dist-test/test/electron/prompt-input-min-width.test.js dist-test/test/electron/side-conversation-ui-source.test.js dist-test/test/electron/btw-store.test.js`

Expected: PASS。

### Task 6: 实现多线程侧栏和双输入框同时显示

**Files:**
- Replace: `src/ui/components/SideConversationPanel.tsx`
- Modify: `src/ui/components/ActivityRail.tsx`
- Modify: `src/ui/App.tsx`
- Modify: `src/ui/events.ts`
- Modify: `test/electron/side-conversation-ui-source.test.ts`
- Modify: `test/electron/chat-selection-comment-actions.test.ts`

- [ ] **Step 1: 写失败的 UI 契约测试**

覆盖自动创建首线程、`+` 新建、线程标签切换/关闭、空初始 transcript、BTW 消息与权限 UI、关闭整个页签发 `btw.parent.close_all`、主 PromptInput 不因 sidechat 打开而隐藏、选区按钮不传选中文本。

- [ ] **Step 2: 运行并确认 RED**

Run: `npm run test:electron:build && node --test dist-test/test/electron/side-conversation-ui-source.test.js dist-test/test/electron/chat-selection-comment-actions.test.js`

Expected: FAIL，当前仍镜像主会话且隐藏主 Composer。

- [ ] **Step 3: 重写 SideConversationPanel**

Panel 只接收 `parentSessionId/connected/sendEvent`，从 `useBtwStore` 读取当前父会话的线程。顶部渲染标签、状态、关闭按钮和 `+`；内容区渲染当前线程私有 `ChatTranscript`、partial、错误和权限；底部挂载带 BTW controller 的同一个 `PromptInput`。

- [ ] **Step 4: 更新 App 生命周期**

打开 sidechat 且无线程时发送一次 `btw.thread.create`；所有 `btw.*` ServerEvent 先交给 `useBtwStore.handleServerEvent`，不交给 `useAppStore`；关闭 Activity Rail 页签时发送 `btw.parent.close_all` 并清理 store；删除主 session 时同步清理。移除隐藏主 PromptInput 的 `activityRailTab === "sidechat"` 条件，确保左右两个输入框同时挂载。

- [ ] **Step 5: 运行并确认 GREEN**

Run: `npm run test:electron:build && node --test dist-test/test/electron/side-conversation-ui-source.test.js dist-test/test/electron/chat-selection-comment-actions.test.js dist-test/test/electron/prompt-input-min-width.test.js`

Expected: PASS。

### Task 7: 更新 dev shim 与浏览器 QA

**Files:**
- Modify: `src/ui/dev-electron-shim.ts`
- Replace: `scripts/qa/side-conversation-smoke.cjs`
- Modify: `package.json`

- [ ] **Step 1: 先更新 QA 断言并确认失败**

QA 必须验证：初始侧聊为空；创建两个线程；两个草稿互不覆盖；分别多轮发送；主消息数不变；关闭一个线程不影响另一个；关闭 sidechat 页签后重新打开无旧线程；页面同时存在主 Composer 和 BTW Composer。

Run: `npm run qa:side-conversation`

Expected: FAIL，旧 shim 只支持普通 session。

- [ ] **Step 2: 为 shim 实现内存 btw.* 模拟**

dev shim 按 threadId 保存临时线程，响应 create/send/stop/close/close_all，并发出与生产一致的 `btw.*` 事件。不得向普通 `qaSideConversationMessagesBySessionId` 写入 BTW 内容。

- [ ] **Step 3: 运行并确认 GREEN**

Run: `npm run qa:side-conversation`

Expected: PASS，并输出多线程、双 Composer、关闭清理的断言摘要。

### Task 8: 80 分停止线与完成审计

**Files:**
- Modify if needed: only files touched above

- [ ] **Step 1: 聚焦测试和覆盖率**

Run:

```powershell
npm run test:electron:build
node --experimental-test-coverage --test `
  dist-test/test/electron/btw-runtime-manager.test.js `
  dist-test/test/electron/btw-store.test.js `
  dist-test/test/electron/side-conversation-background-session.test.js `
  dist-test/test/electron/side-conversation-ui-source.test.js `
  dist-test/test/electron/chat-selection-comment-actions.test.js `
  dist-test/test/electron/prompt-input-min-width.test.js
```

Expected: 0 failures；新增核心模块 line coverage >= 80%。

- [ ] **Step 2: 类型、构建和范围 lint**

Run:

```powershell
npm run build
npx eslint src/electron/libs/btw-runtime-manager.ts src/electron/ipc-handlers.ts src/electron/types.ts src/ui/store/useBtwStore.ts src/ui/components/SideConversationPanel.tsx src/ui/components/prompt-input/PromptInput.tsx src/ui/components/prompt-input/useBtwPromptController.ts src/ui/App.tsx src/ui/types.ts
git diff --check
```

Expected: build PASS；ESLint 0 errors；diff-check PASS。

- [ ] **Step 3: 浏览器和视觉验收**

Run: `npm run qa:side-conversation`

然后按 `visual-verdict` 检查右栏线程标签、空状态、双 Composer、窄宽度和运行状态，目标 >= 90/100。

- [ ] **Step 4: 要求逐项审计**

逐项证明：多线程、多轮、创建时快照、完整工具、权限隔离、主历史不污染、双输入框独立、选区不预填、关闭单线程清除、关闭页签清空、重启不恢复。任一证据不足则继续修复；全部成立且覆盖率达到 80% 后停止。
