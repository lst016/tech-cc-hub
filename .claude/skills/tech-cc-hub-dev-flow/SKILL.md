---
name: tech-cc-hub-dev-flow
description: tech-cc-hub project development workflow guardrail. Use when working in /Users/lst01/Desktop/学习/tech-cc-hub or when the task involves Electron + React UI, ActivityRail/right sidebar, Preview/Workspace file tree, AionUi full-copy integration, Codex Agent SDK routing/model issues, Monaco code preview, browser annotations, code comments, or any user complaint that prior work was half-finished or not self-tested.
---

# tech-cc-hub Development Flow

## Non-negotiable rule

Do not report UI or runtime work as done from source changes alone. For product-facing UI, verify the actual running page or Electron window before saying it works.

If a full self-test is impossible, say exactly what was not tested and why. Do not imply confidence from partial checks.

## Startup and target surface

- Treat `npm run dev` as the default local startup command for this project.
- Default validation target is the running app, not just source files.
- When the user mentions the in-app browser at `http://localhost:4173/`, test that browser surface directly or with browser automation against the same URL.
- If Electron-specific preload or main-process IPC changed, restart `npm run dev` before validation. Hot reload is not enough for preload/main changes.

## Work style

- Prefer small, complete vertical slices over broad half-integrations.
- When touching UI, test the exact interaction the user will try, not only the underlying API.
- When the user says `全量 cv`, keep source directory structure and behavior as close as possible to the reference. Do not replace it with a lightweight rewrite unless explicitly approved.
- When the user says a design is ugly, align to the requested visual language before adding more features. For current right-sidebar Preview work, the requested visual language is VS Code white theme: white background, light gray separators, compact tree, minimal blue accent, no decorative gradients, no cream/green cards, no heavy shadows.

## Required self-test checklist for UI changes

Run a browser-level check for the changed surface before final reply.

For `ActivityRail` / right sidebar changes:

- Open the running app at `http://localhost:4173/`.
- Click the affected tab, such as `预览`.
- Confirm the app does not white-screen.
- Capture or inspect console/page errors.
- Confirm the visible state changed in the browser, not just in code.

For Preview/Workspace/file tree work:

- Click `预览`.
- Confirm the file tree renders real project files.
- Click a text or JSON file such as `package.json`.
- Confirm Monaco renders actual file contents and does not remain at `Loading...`.
- Confirm there are no Monaco worker path errors such as `worker_file` missing.

For code selection/comment workflows:

- Open a code file in Monaco.
- Select a range of code.
- Confirm the selection toolbar appears.
- Click `粘贴到输入框` and confirm a UI card appears above the composer, not raw text in the textarea.
- Click `评论`, enter a comment, and confirm a comment UI card appears.
- Confirm textarea is not polluted by raw `# Code selection`, `# Code comments`, or `<code_references>` text.
- Confirm send serialization still includes the structured code reference payload.

For chat composer / AionUi-aligned workflows:

- Type `@src` in the composer and confirm the file mention menu opens.
- Select a file or directory and confirm a composer reference card appears; the textarea must not contain `<file_references>`.
- Select text inside a user or assistant message and confirm `引用选区` creates a message reference card; the textarea must not contain `<message_references>`.
- Open `/` command suggestions and confirm keyboard `ArrowUp/ArrowDown`, `Enter/Tab`, and `Escape` work.
- If the session is running, queue a second prompt and confirm the queue card shows attachments/context count and can be edited, inserted, deleted, or cleared.
- Run `npm run qa:chat-ui` for browser-level smoke coverage before reporting the chat UI complete.

## Browser automation pattern

If Browser Use tools are available, use them. If not available, use local browser automation with Playwright only after installing/using project dependencies as needed.

Recommended smoke script shape:

```js
const { chromium } = require('@playwright/test');
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
const logs = [];
page.on('console', msg => logs.push(`[console:${msg.type()}] ${msg.text()}`));
page.on('pageerror', err => logs.push(`[pageerror] ${err.stack || err.message}`));
await page.goto('http://localhost:4173/', { waitUntil: 'domcontentloaded', timeout: 15000 });
```

After interaction, inspect `logs` for `pageerror`, Vite transform errors, Monaco worker errors, and React runtime crashes.

## Common failure modes to check

- `prompt.startsWith is not a function`: a store setter received a function instead of a string. Zustand setters in this project may not be React `setState`; pass final string values explicitly.
- Monaco stuck at `Loading...`: configure `@monaco-editor/react` loader with local `monaco-editor` and ensure Vite does not optimize Monaco workers incorrectly.
- Monaco worker errors with `worker_file`: exclude `monaco-editor` from Vite `optimizeDeps` or configure workers with Vite `new URL(..., import.meta.url)` module workers.
- White screen after opening Preview: check missing providers/contexts first, such as React Router context, AionUi IPC bridge shape, or hook-order violations.
- React hook order errors: do not return before all hooks have run. Move conditional rendering after hooks.
- UI cards becoming raw text: keep user-facing context as composer cards; serialize to prompt only on send.

## AionUi full-copy integration rules

- Copy original AionUi modules into alias-compatible paths when the user wants full CV.
- Preserve module boundaries where possible: `Preview`, `Workspace`, `hooks/file`, `utils/file`.
- Add adapter/shim layers for `@/common`, IPC bridge, layout/theme/conversation contexts, and platform services.
- Do not expose AionUi raw UI if it clashes with tech-cc-hub. Wrap or restyle it to the current product visual language.
- Keep hard dependencies explicit in `package.json`; do not rely on hidden transitive packages.

## Model routing/debugging workflow

When debugging selected model vs actual backend usage:

- Separate UI selection, runtime settings, SDK model option, env overrides, and upstream gateway logs.
- Check for global settings overriding local UI state, especially Claude/Codex settings files and environment variables.
- For custom gateways, verify model option and base URL shape separately.
- Prefer an end-to-end prompt that logs route/model and confirms upstream request counters.

## Final response standard

Before saying done, state the concrete interaction that was tested. Example:

- `已在 http://localhost:4173/ 自测：打开预览 -> 点击 package.json -> Monaco 渲染内容 -> 选区生成代码引用卡片 -> 评论生成评论卡片。`

If anything is untested, state it plainly and do not frame the work as fully verified.
