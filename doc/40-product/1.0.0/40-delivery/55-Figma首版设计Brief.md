---
doc_id: "PRD-100-55"
title: "55-Figma首版设计Brief"
doc_type: "delivery"
layer: "PM"
status: "active"
version: "1.0.0"
last_updated: "2026-04-19"
owners:
  - "Product"
  - "Design"
tags:
  - "claw"
  - "docs"
  - "1.0.0"
  - "figma"
  - "design-brief"
---

# 55-Figma首版设计Brief

## Purpose
把 CLAW 1.0.0 的前端核心工作台收敛成可直接进入 Figma 的设计交付说明，避免后续只剩风格词没有屏幕级落位。

## Scope
本文件只覆盖 1.0.0 首版桌面端核心设计稿：
- `Chat Workspace`
- `Task Graph Workspace`
- `Replay / Analysis` 打开态

本文件不定义代码实现，不覆盖移动端，不要求首轮就产出完整 design system library。

## Actors / Owners
- Owner: Product
- Readers: 设计、前端、组件实现者

## Inputs / Outputs
- Inputs:
  - [30-前端信息架构.md](../../../30-operations/30-%E5%89%8D%E7%AB%AF%E4%BF%A1%E6%81%AF%E6%9E%B6%E6%9E%84.md)
  - [44-页面与交互映射.md](./44-%E9%A1%B5%E9%9D%A2%E4%B8%8E%E4%BA%A4%E4%BA%92%E6%98%A0%E5%B0%84.md)
  - [48-组件索引.md](./48-%E7%BB%84%E4%BB%B6%E7%B4%A2%E5%BC%95.md)
  - [51-前端UI风格规范.md](./51-%E5%89%8D%E7%AB%AFUI%E9%A3%8E%E6%A0%BC%E8%A7%84%E8%8C%83.md)
- Outputs:
  - 首版 Figma 页面结构
  - 桌面工作台高保真设计稿
  - 关键态屏幕与标注

## Core Concepts
- `Operator Console + Research Desk`: 工程控制台和研究台的混合气质
- `Desktop First`: 默认面向 1440px 以上桌面宽度
- `Dual Axis`: `Chat` 与 `Task Graph` 都是一等入口
- `Evidence First`: 时间线、产物、回放不是附属信息
- `Single Interactive Agent`: 聊天区只允许 `Claude Code / Codex` 二选一，默认 `Claude Code`

## Behavior / Flow
### Deliverable Inventory

首版 Figma 文件至少包含以下 3 个核心 frame：

| Frame | Suggested Name | Size | Primary Goal |
|---|---|---|---|
| `Screen-01` | `CLAW / Chat Workspace / Default` | `1600 x 1040` | 定义聊天主轴默认工作台 |
| `Screen-02` | `CLAW / Task Graph / Running` | `1600 x 1040` | 定义任务图主轴和 Worker 状态 |
| `Screen-03` | `CLAW / Replay Analysis / Expanded` | `1600 x 1040` | 定义证据闭环和分析阅读态 |

### Shared Shell

3 个屏幕必须共用同一个外壳结构：

| Region | Width Guideline | Content |
|---|---|---|
| `Left Rail` | `260px` | Session、最近项目、视图切换 |
| `Main Workspace` | `fluid, min 780px` | Chat 或 Task Graph 主内容 |
| `Right Context Rail` | `360px` | Timeline、节点详情、冲突、分析摘要 |
| `Bottom Tray` | `220px collapsed / 280px expanded` | Files、Artifacts、Events |

### Screen-01 Chat Workspace

应表现的关键信息：
- Session Header
- `Agent Picker`
- Message Stream
- Chat Composer
- Live Timeline 摘要
- 右侧 `Artifacts / Replay / Analysis` 入口

关键规则：
- `Agent Picker` 必须只出现两个选项：`Claude Code` 与 `Codex`
- 默认高亮 `Claude Code`
- 主消息区不能做成单列满宽聊天气泡页面，必须保留“工作台”结构
- Timeline 应显式露出工具调用、文件变化、人工介入痕迹

建议文案区块：
- 左侧 Session 分组：`Today`, `Pinned`, `Recent`
- 中央标题：`Current Session`
- 右侧摘要卡：`Evidence`, `Replay`, `Analysis`, `Conflicts`

### Screen-02 Task Graph Workspace

应表现的关键信息：
- Task Graph Canvas
- Task Node Card
- Dependency Editor
- Task Inspector Drawer
- Worker Status Badge
- Task Result Panel / Bottom Tray

关键规则：
- 主画布不允许只是流程图截图感，必须体现“可操作工作台”
- 节点至少展示 `title / status / assigned agent / progress / latest event`
- 右侧 drawer 应明确区分 `Task Details` 和 `Worker Run`
- `Claude Code / Codex` 在任务图中可并存，但通过节点指派体现，不通过顶部聊天切换体现

### Screen-03 Replay / Analysis Expanded

应表现的关键信息：
- 时间线列表
- 关键转折点
- 人工介入标记
- 返工 / 错误 / 完成率摘要
- Spec 调优建议区

关键规则：
- 分析页不是 BI 仪表盘，重点是“问题解释 + 证据回跳”
- 必须能一眼看出：
  - 这次任务哪里卡住
  - 人工在哪一步介入
  - 哪个 spec 值得复用或修正

## Interfaces / Types
### Visual Tokens

优先使用以下视觉 token 方向：

| Token | Value | Usage |
|---|---|---|
| `--bg-canvas` | `#F4F1EA` | 应用底色 |
| `--bg-panel` | `#FBF9F4` | 面板底色 |
| `--bg-elevated` | `#FFFFFF` | 浮层 / 卡片 |
| `--line-soft` | `#D9D2C6` | 边界线 |
| `--text-primary` | `#1F252B` | 主文本 |
| `--text-secondary` | `#58636E` | 次级文本 |
| `--signal-running` | `#1D4ED8` | 运行中 |
| `--signal-active` | `#0F766E` | 激活 / 成功 |
| `--signal-warning` | `#B45309` | 注意 |
| `--signal-danger` | `#B42318` | 失败 |
| `--signal-spec` | `#7C3AED` | Spec 资产辅助识别 |

### Typography

- UI Sans: `IBM Plex Sans`
- Mono: `JetBrains Mono`
- Panel Title: `16 / 20 / Semibold`
- Body: `13 / 18 / Regular`
- Meta + Status: `12 / 16 / Medium or Mono`

### Component Entry Points

优先引用这些组件文档：
- [CMP-001-SessionSidebar.md](./components/CMP-001-SessionSidebar.md)
- [CMP-002-AgentPicker.md](./components/CMP-002-AgentPicker.md)
- [CMP-004-MessageStream.md](./components/CMP-004-MessageStream.md)
- [CMP-005-LiveTimelinePanel.md](./components/CMP-005-LiveTimelinePanel.md)
- [CMP-007-TaskGraphCanvas.md](./components/CMP-007-TaskGraphCanvas.md)
- [CMP-010-TaskInspectorDrawer.md](./components/CMP-010-TaskInspectorDrawer.md)

## Failure Modes
- 如果聊天稿只像通用 AI 聊天窗，CLAW 的产品定位会立刻变弱。
- 如果任务图稿只像静态流程图，后面前端会很难做出真实可操作感。
- 如果分析稿只堆图表，没有证据入口，产品差异会被稀释。

## Observability
- 设计稿需显式标出这些事件入口：
  - `agent_selected`
  - `message_submitted`
  - `task_node_opened`
  - `timeline_event_opened`
  - `replay_opened`
  - `analysis_drilldown_opened`

## Open Questions / ADR Links
- 当前会话未暴露 `create_new_file / use_figma` 写稿能力，因此本文件作为直接设计输入先落地。
- 已生成的 FigJam 信息架构图可作为配套输入：
  - [CLAW Desktop IA](https://www.figma.com/online-whiteboard/create-diagram/be27b3a0-10a9-4bd1-bc8c-673b3330be46?utm_source=chatgpt&utm_content=edit_in_figjam&oai_id=&request_id=95110cc0-b77b-4e9f-8198-54546ee7c52b)
