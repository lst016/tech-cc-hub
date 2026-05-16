# doc/20-specs/30-会话执行分析与标注规范.md

> 模块：`doc` · 语言：`markdown` · 行数：425

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
---
doc_id: "30"
title: "30-会话执行分析与标注规范"
doc_type: "contract"
layer: "L2"
status: "active"
version: "1.0.0"
last_updated: "2026-04-20"
owners:
  - "Product"
  - "CLAW Core"
tags:
  - "claw"
  - "docs"
  - "1.0.0"
  - "L2"
  - "contract"
  - "analysis"
  - "session"
  - "activity-rail"
---

# 30-会话执行分析与标注规范

## Purpose
定义单个会话内的执行分析模型、右侧执行轨迹工作台、会话分析页、人工标注能力与 AI 调优记录能力，确保“实时看懂执行过程”和“事后系统复盘”使用同一套对象与口径。

## Scope
本文覆盖：
- 右侧执行轨迹区的增强信息架构
- 单会话分析页的信息架构
- `AI 计划步骤`、`实际执行步骤`、`节点`、`标注`、`AI 调优动作` 的最小数据模型
- 从原始消息到分析投影的生成与重建规则

本文不覆盖：
- 多会话汇总分析页
- 团队协作权限模型
- 自动采纳 AI 调优建议并直接重跑

## Actors / Owners
- Owner: Product + Core Runtime
- Primary Readers: Electron 前端、会话存储、执行轨迹右栏、会话分析页
- Secondary Readers: 后续跨会话分析、提示词调优、QA 回放

## Inputs / Outputs
- Inputs:
  - `messages` 原始会话消息流
  - `session status`
  - 用户对步骤或节点的人工标记、备注、评论
  - 用户从步骤或节点发起的 AI 调优动作
- Outputs:
  - 右侧执行轨迹工作台投影
  - 单会话分析页投影
  - 可持久化的步骤、节点、标注与调优记录

## Product Goals
- 让用户能明确看到 `Step 1/2/3/4/5` 这类 AI 原始计划，并知道它们是否真正落地。
- 让用户能同时看到系统归纳出的“实际执行步骤”，从而理解真实执行轨迹。
- 让 `Step` 和 `节点` 都能被人工标记、备注和评论。
- 让用户能从 `Step` 或 `节点` 直接发起 AI 调优动作，并保留调优记录。
- 让右侧实时 workbench 和单会话分析页共享一套分析对象，避免两套口径。

## Non-Goals
- 不要求第一期完成跨会话排行榜、趋势分析或模型横向对比。
- 不要求第一期提供复杂评论线程、多人协作审批或权限隔离。
- 不要求第一期自动根据 AI 调优结果修改会话或自动重试执行。

## Core Concepts
- `Plan Step`:
  来自 AI 原始计划文本的编号步骤，例如 `Step 1`、`Step 2`、`Step 3`。该对象代表“模型原本打算怎么做”。
- `Execution Step`:
  系统根据工具调用、结果与阶段语义归纳出的实际执行步骤。该对象代表“系统实际上做了什么”。
- `Analysis Node`:
  时间线中的最小分析单元，通常对应工具调用、中间文本、最终结果、人工确认等证据节点。
- `Plan/Execution Link`:
  用于表达某个原始计划步骤和某个实际执行步骤之间的关系，例如 `matched`、`partial`、`drifted`、`unmapped`。
- `Annotation`:
  用户挂在 `Plan Step`、`Execution Step` 或 `Node` 上的人工反馈对象，统一承载标签、备注、评论与问题状态。
- `Optimization Action`:
  从 `Execution Step` 或 `Node` 发起的一次 AI 调优动作，包含输入快照、动作类型和结果。
- `Projection`:
  基于原始消息重建的分析投影层。投影可重算，人工标注与调优记录不可被重算覆盖。

## Experience Model
产品层分为两个互补视图：

- `右侧执行轨迹工作台`
  - 定位：实时观察与快速复盘入口
  - 目标：快速看懂本次执行如何从计划走向结果
  - 特点：高密度、可折叠、可直接打标和发起 AI 调优

- `单会话分析页`
  - 定位：完整复盘页
  - 目标：系统性回答“原计划是什么、实际怎么跑、哪里偏了、人工怎么判断、后续怎么调”
  - 特点：结构化汇总、适合横向比较步骤与证据

右侧与分析页必须互相可跳转：
- 右侧可进入“查看本会话完整分析”
- 分析页可反跳到某个执行步骤或证据节点

## Right Rail Information Architecture
右侧执行轨迹工作台必须采用“摘要 + 双轨步骤 + 节点 + 详情抽屉”结构：

1. 顶部摘要条
   - 展示：`状态 / 模型 / 耗时 / 输入 / 上下文 / 输出 / 成败 / 告警数`
   - 提供进入单会话分析页的入口

2. `AI 计划步骤` 区
   - 保留原始 `Step 1/2/3/4/5`
   - 展示每个计划步骤的状态：`未落地 / 执行中 / 已完成 / 跑偏 / 无计划`
   - 不得被系统归纳步骤覆盖或改写掉原编号

3. `实际执行步骤` 区
   - 展示系统归纳后的执行步骤，例如 `检查现状`、`修改代码`、`构建验证`
   - 每步显示：`关联节点数 / 耗时 / 输入 / 上下文 / 输出 / 成败`
   - 每步必须标明其映射到哪些 `AI 计划步骤`

4. `节点时间线` 区
   - 作为证据层展示工具调用、中间结果、最终结果和人工确认节点
   - 默认高密度紧凑展示，不承担全部解释责任

5. `详情抽屉`
   - 统一展示 `概览`、`证据`、`原始内容`
   - 原始输入输出区必须可读，不得出现“看似空白”的视觉状态

## Session Analysis Page Information Architecture
单会话分析页必须包含以下模块：

1. `会话总览`
   - `状态 / 模型 / 总耗时 / 输入 / 上下文 / 输出 / 成败 / 告警 / Step 覆盖率 / 标注数`

2. `计划 vs 执行`
   - 左侧为 `AI 计划步骤`
   - 右侧为 `实际执行步骤`
   - 中间展示映射关系：`已落地 / 部分落地 / 未落地 / 跑偏新增`

3. `执行步骤分析表`
   - 每个执行步骤一行
   - 至少包含：`步骤名 / 对应计划步骤 / 耗时 / 节点数 / 输入 / 上下文 / 输出 / 成败 / 标注数 / 调优次数`

4. `关键证据区`
   - 聚焦失败节点、最长耗时节点、上下文热点节点、重复调用节点和人工标记节点

5. `人工反馈区`
   - 汇总 `Step` 级和 `Node` 级的标签、备注、评论与未解决问题

6. `AI 调优记录`
   - 展示基于步骤或节点发起的解释、建议、提示词重写与策略重试建议

7. `完整节点时间线`
   - 允许下钻，但不抢首屏优先级

## Interaction Rules
### Step-Level Actions
`Execution Step` 是第一优先级操作对象，必须支持：
- `标记`
- `备注`
- `评论`
- `AI 调优`

### Node-Level Actions
`Analysis Node` 也必须支持上述动作，但视觉层级低于 `Execution Step`，用于精细补充。

### Annotation Types
第一期统一使用 `Annotation` 承载以下类型：
- `tag`
- `note`
- `comment`
- `issue`
- `good`
- `todo`

第一期推荐标签集合：
- `有问题`
- `做得好`
- `待跟进`
- `关键信息`

### Resolution
问题类标注必须支持 `已解决` 状态，避免问题堆积后无法区分当前遗留项与历史项。

### Optimization Actions
第一期 AI 调优入口固定为以下动作：
- `explain`
- `suggest`
- `rewrite_prompt`
- `retry_strategy`

AI 调优必须基于对象发起，不允许作为脱离上下文的空动作：
- 从 `Execution Step` 发起时，至少携带步骤摘要、对应计划步骤、关联节点摘要与人工反馈
- 从 `Node` 发起时，至少携带节点输入、节点输出、前后文摘要与所属执行步骤

AI 调优结果第一期只记录，不直接自动改写原会话或自动重跑。

## Storage Model
原始消息表继续作为唯一事实源，不在原始消息表中混入人工反馈字段。

建议新增以下投影与反馈对象：

### `session_plan_steps`
- `id`
- `session_id`
- `step_index`
- `title`
- `raw_text`
- `status`
- `source_timeline_id`
- `created_at`
- `updated_at`

### `session_execution_steps`
- `id`
- `session_id`
- `step_index`
- `title`
- `kind`
- `status`
- `started_at`
- `ended_at`
- `duration_ms`
- `input_chars`
- `context_chars`
- `out
... (truncated)
```
