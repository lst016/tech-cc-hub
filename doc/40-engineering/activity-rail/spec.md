---
doc_id: "DOC-SPEC-ACTIVITY-RAIL"
title: "Activity Rail / Trace Analysis 模块 Spec"
doc_type: "spec"
layer: "L4"
status: "active"
version: "1.0.0"
last_updated: "2026-05-01"
owners:
  - "tech-cc-hub Core"
audience:
  - "frontend"
  - "electron"
source_of_truth: true
supersedes: []
superseded_by: null
tags:
  - "tech-cc-hub"
  - "engineering"
  - "activity-rail"
  - "trace"
  - "spec"
---

# Activity Rail / Trace Analysis 模块 Spec

## Purpose

定义 Agent 执行轨迹的可视化和分析实现。ActivityRail 是右侧栏的核心组件，负责将 Agent 执行过程转化为可复盘的结构化视图。

## Scope

- ActivityRail 主组件：时间线渲染、阶段分组、指标展示、详情抽屉
- 数据模型：ActivityNode 类型体系、metrics 合并、节点分类
- 可视化：进度节点动画、过滤/排序、上下文用量面板
- 不在本文档范围：SDK 原始消息解析（那是 `activity-rail-model.ts` 的职责，见 Events Spec）

## Active Entry Points

| 入口 | 文件 | 说明 |
|------|------|------|
| ActivityRail | `src/ui/components/ActivityRail.tsx` | 主组件（~1222 行） |
| activity-rail-model | `src/shared/activity-rail-model.ts` | 数据模型与解析 |
| EventCard | `src/ui/components/EventCard.tsx` | 单事件卡片 |
| test | `src/electron/activity-rail-model.test.ts` | 模型单元测试（7 个） |

## Key Components

### ActivityRail

主组件导出 `ActivityRail`（默认导出）。

核心渲染分区：

| 区域 | 函数 | 说明 |
|------|------|------|
| 时间线视图 | `renderTimelineWithStages()` | 按 inspect → implement → verify → deliver 阶段分组的时间线 |
| 时间线行 | `TimelineItemRow()` | 单个执行节点的行渲染 |
| 指标摘要 | `MetricsStrip()` | Token/字符/时长/成功率的摘要条 |
| 分析卡片 | `AnalysisCard()` | 上下文用量、Token 分桶等分析视图 |
| 上下文用量 | `ContextUsagePanel()` | 上下文窗口使用率可视化和分段 |
| 上下文分桶 | `ContextBucketRow()` / `ContextDistributionModal()` | 按来源分桶的上下文详情 |
| 详情抽屉 | `DetailDrawer()` / `DetailSectionCard()` | 点击节点的详情面板 |

### 节点类型映射

将 `ActivityNode`（来自 `activity-rail-model.ts`）映射到 UI 标签和色调：

| NodeKind | 中文标签 | 色调 |
|----------|---------|------|
| `context` | 上下文 | info |
| `plan` | 计划 | info |
| `assistant_output` | 输出 | neutral |
| `tool_input` | 工具调用 | neutral |
| `file_read` | 文件读取 | neutral |
| `file_write` | 文件写入 | neutral |
| `terminal` | 终端 | neutral |
| `browser` | 浏览器 | neutral |
| `mcp` | MCP | neutral |
| `handoff` | 子Agent | info |
| `error` | 错误 | error |
| `lifecycle` | 生命周期 | neutral |
| `agent_progress` | 进度 | info |
| `permission` | 权限 | warning |

### 阶段分组

| 阶段 | ActivityStageKind | 顺序 |
|------|-------------------|------|
| 探查 | `inspect` | 1 |
| 实现 | `implement` | 2 |
| 验证 | `verify` | 3 |
| 交付 | `deliver` | 4 |

### 过滤器

| 过滤器键 | 标签 |
|----------|------|
| `all` | 全部 |
| `attention` | 关注 |
| `context` | 上下文 |
| `tool` | 工具 |
| `result` | 结果 |
| `flow` | 流程 |

### 动画状态

- 运行中任务：脉冲动画（`animate-pulse`）
- `agent_progress` 节点：进度指示器
- `activeAgentNodes` 过滤：仅显示活跃的子 Agent 节点

## Data Flow

```
SDK 原始消息
  → activity-rail-model.ts 解析/分类
    → ActivityNode[] (已类型化、已 enrich)
      → ActivityRail.tsx 渲染
        ├─ renderTimelineWithStages() → 时间线
        ├─ MetricsStrip() → 指标摘要
        └─ DetailDrawer() → 详情面板
```

## Key Files

```
src/shared/
└── activity-rail-model.ts          # 数据模型、解析器、metrics 合并

src/ui/components/
├── ActivityRail.tsx                # 主组件
├── EventCard.tsx                   # 事件卡片
└── ActivityRailToolbar.tsx         # 工具栏（过滤/排序）

src/electron/
└── activity-rail-model.test.ts     # 模型测试
```

## Compatibility

- 新增 `NodeKind` 值：需同步更新 `NODE_KIND_LABELS`、`toneClasses` 映射
- 新增 `ActivityStageKind` 值：需同步更新 `STAGE_ORDER` 数组
- `ActivityExecutionMetrics` 字段只增不减
- 阶段分组逻辑变更需更新 `renderTimelineWithStages()`

## Acceptance Criteria

- [ ] 所有 NodeKind 值在 UI 有对应的视觉呈现
- [ ] 运行中任务显示脉冲动画，完成后动画消失
- [ ] 子 Agent 节点在父任务下正确缩进
- [ ] MetricsStrip 的 Token/时长/成功率数据与原始消息一致
- [ ] 过滤器切换不影响时间线数据结构
- [ ] 详情抽屉点击节点后正确展示
- [ ] `npm run test:activity-rail-model` 全部通过
