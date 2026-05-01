---
doc_id: "DOC-SPEC-CHAT-COMPOSER"
title: "Chat / Composer 模块 Spec"
doc_type: "spec"
layer: "L4"
status: "active"
version: "1.0.0"
last_updated: "2026-05-01"
owners:
  - "tech-cc-hub Core"
audience:
  - "frontend"
source_of_truth: true
supersedes: []
superseded_by: null
tags:
  - "tech-cc-hub"
  - "engineering"
  - "chat"
  - "composer"
  - "spec"
---

# Chat / Composer 模块 Spec

## Purpose

定义聊天输入、消息流渲染和决策交互的实现结构。Chat 是用户与 Agent 交互的主界面。

## Scope

- 输入组件：PromptInput（文本输入、附件、slash 命令、@ 文件引用、运行时覆盖）
- 决策组件：DecisionPanel（权限确认、工具审批）
- 消息流渲染：Markdown 渲染、代码高亮、图片内联
- 不在本文档范围：会话列表侧边栏（Settings/Skills 模块）、ActivityRail 右栏

## Active Entry Points

| 入口 | 文件 | 行数 |
|------|------|------|
| PromptInput | `src/ui/components/PromptInput.tsx` | ~1940 |
| DecisionPanel | `src/ui/components/DecisionPanel.tsx` | — |
| ComposerContextCard | `src/ui/components/ComposerContextCard.tsx` | — |
| Markdown 渲染 | `src/ui/render/markdown.tsx` | — |

## Key Components

### PromptInput

核心聊天输入组件。Props：

```typescript
interface PromptInputProps {
  sessionId: string;
  sessionStatus: SessionStatus;
  onSend: (prompt: string, attachments?: PromptAttachment[], runtime?: RuntimeOverrides) => void;
  onStop: () => void;
  onAppend: (prompt: string, attachments?: PromptAttachment[]) => void;
  disabled?: boolean;
}
```

功能矩阵：

| 功能 | 触发方式 | 处理逻辑 |
|------|---------|---------|
| 发送消息 | Enter / 点击发送 | `session.start` 或 `session.continue` ClientEvent |
| 停止执行 | 点击停止按钮 | `session.stop` ClientEvent |
| 追加指令 | 运行中输入 | `session.append` ClientEvent |
| Slash 命令 | `/` 触发 | 本地过滤匹配，最多 16 条，预览 8 条 |
| @ 文件引用 | `@` 触发 | 扫描工作目录文件，最多 260 条，预览 10 条 |
| 附件拖放 | 拖拽文件到输入区 | 生成 PromptAttachment 数组 |
| 运行时覆盖 | 通过 RuntimeOverrides 传递 | model、permissionMode、outputFormat、reasoningMode |

### DecisionPanel

权限请求的确认/拒绝 UI：

- 展示 `PermissionRequest`（toolUseId、toolName、input）
- 用户确认 → `permission.response` ClientEvent，result 为确认后的工具输入
- 用户拒绝 → `permission.response` ClientEvent，result 标记为 denied

### Markdown 渲染

- 基于 ReactMarkdown + rehype 插件
- 支持代码块语法高亮（highlight.js）
- 图片内联：存储在 SQLite 中的 base64 图片按需回填渲染
- Tool use 结果卡片化展示

## Data Flow

```
用户输入 (PromptInput)
  → window.electron.sendEvent({ type: "session.start" | "session.continue" | "session.append" })
    → ipc-handlers.ts → runner.ts → Claude Agent SDK
      → stream.message ServerEvent → 渲染进程 MessageStream
        → Markdown 渲染 → UI 展示

权限请求:
  runner.ts → permission.request ServerEvent → DecisionPanel
    → 用户确认/拒绝 → permission.response ClientEvent → runner.ts
```

## Key Files

```
src/ui/components/
├── PromptInput.tsx          # 聊天输入框（主组件）
├── DecisionPanel.tsx        # 权限确认面板
├── ComposerContextCard.tsx  # 上下文预览卡片
├── MessageStream.tsx        # 消息列表渲染
├── MessageCard.tsx          # 单条消息卡片
└── AgentPicker.tsx          # Agent 选择器

src/ui/render/
├── markdown.tsx             # Markdown → React 渲染管线
└── code-block.tsx           # 代码块组件

src/ui/hooks/
├── useChatSession.ts        # 会话状态 hook
└── useAutoScroll.ts         # 消息流自动滚动
```

## Compatibility

- Slash 命令目录来自主进程 `slash-command-catalog.ts`，新增命令无需改前端
- 附件类型扩展：新增 `PromptAttachment` 的 type 值，前端自动透传
- RuntimeOverrides 新增字段只需在 `src/ui/types.ts` 扩展

## Acceptance Criteria

- [ ] Enter 发送、Shift+Enter 换行行为正确
- [ ] Slash 命令过滤和预览功能正常
- [ ] @ 文件引用扫描不阻塞 UI（debounce）
- [ ] 运行中 append 指令不覆盖已有上下文
- [ ] 权限超时自动拒绝
- [ ] Markdown 代码块和图片渲染无 XSS 风险
