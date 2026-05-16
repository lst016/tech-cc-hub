# scripts/qa/knowledge-chat-injection-smoke.mjs

> 模块：`scripts` · 语言：`javascript` · 行数：147

## 文件职责

验证knowledge overview被正确注入到chat系统prompt中

## 关键符号

- `subscribeServerEvents@0 - 通过SSE订阅chat事件流，解析data帧`
- `callBridge@0 - 通过fetch调用bridge RPC接口`
- `extractAssistantText@0 - 从assistant消息中提取text content pieces`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```javascript
const BRIDGE_ORIGIN = process.env.TECH_CC_HUB_DEV_BRIDGE_ORIGIN || "http://127.0.0.1:4317";
const WORKSPACE_ROOT = process.env.KNOWLEDGE_QA_WORKSPACE || process.cwd();
const TIMEOUT_MS = Number(process.env.KNOWLEDGE_CHAT_QA_TIMEOUT_MS || 150000);
const EXPECTED_TITLE = "tech-cc-hub 项目概览";
const EXPECTED_REPLY = "KNOWLEDGE_INJECTION_OK";

function fail(message) {
  throw new Error(message);
}

async function callBridge(method, ...args) {
  const response = await fetch(`${BRIDGE_ORIGIN}/rpc/${encodeURIComponent(method)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ args }),
  });
  const payload = await response.json();
  if (!response.ok || payload?.success === false) {
    fail(payload?.error || `Bridge call failed: ${method}`);
  }
  return payload.result;
}

function extractAssistantText(message) {
  if (!message || message.type !== "assistant") return "";
  const content = message.message?.content;
  if (!Array.isArray(content)) return "";
  const pieces = [];
  for (const item of content) {
    if (item?.type === "text" && typeof item.text === "string") {
      pieces.push(item.text);
    }
  }
  return pieces.join("\n");
}

async function subscribeServerEvents(onEvent, signal) {
  const response = await fetch(`${BRIDGE_ORIGIN}/events/server`, { signal });
  if (!response.ok || !response.body) {
    fail(`Unable to subscribe server events: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (!signal.aborted) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() || "";
    for (const frame of frames) {
      const dataLines = frame
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart());
      if (dataLines.length === 0) continue;
      onEvent(JSON.parse(dataLines.join("\n")));
    }
  }
}

async function main() {
  const overviewResult = await callBridge("invoke", "knowledge:overview", { workspaceKey: WORKSPACE_ROOT });
  const overview = overviewResult?.overview;
  if (typeof overview !== "string" || !overview.includes("<knowledge_overview")) {
    fail("Knowledge overview is missing from the runner prompt append path");
  }
  if (!overview.includes(EXPECTED_TITLE)) {
    fail(`Knowledge overview does not include generated title: ${EXPECTED_TITLE}`);
  }

  const controller = new AbortController();
  const events = [];
  let sessionId = null;
  let assistantText = "";
  let completed = false;
  let errorMessage = "";

  const subscription = subscribeServerEvents((event) => {
    events.push(event.type);
    if (event.type === "session.status" && event.payload?.sessionId) {
      sessionId = event.payload.sessionId;
      if (event.payload.status === "completed") completed = true;
      if (event.payload.status === "error") errorMessage = event.payload.error || "session.status=error";
    }
    if (event.type === "runner.error") {
      errorMessage = event.payload?.message || "runner.error";
    }
    if (event.type === "stream.message") {
      sessionId = event.payload?.sessionId || sessionId;
      assistantText += `\n${extractAssistantText(event.payload?.message)}`;
    }
  }, controller.signal).catch((error) => {
    if (!controller.signal.aborted) errorMessage = String(error);
  });

  const startResult = await callBridge("sendClientEvent", {
    type: "session.start",
    payload: {
      title: "QA Knowledge Injection",
      cwd: WORKSPACE_ROOT,
      prompt: [
        "根据当前可用的知识库概览判断：",
        `如果你能看到 Repo Wiki 条目标题「${EXPECTED_TITLE}」，只回复 ${EXPECTED_REPLY}。`,
        "不要调用工具，不要解释。",
      ].join("\n"),
      runtime: {
        runSurface: "development",
        outputFormat: "none",
      },
    },
  });
  for (const event of startResult?.events || []) {
    if (event.type === "session.status" && event.payload?.sessionId) sessionId = event.payload.sessionId;
  }

  const startedAt = Date.now();
  while (Date.now() - startedAt < TIMEOUT_MS) {
    if (assistantTex
... (truncated)
```
