# doc/40-product/1.0.0/10-requirements/18-PRD-Trace Workbench参考图拆解与页面重构.md

> 模块：`doc` · 语言：`markdown` · 行数：465

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
---
doc_id: "PRD-100-18"
title: "18-PRD-Trace Workbench参考图拆解与页面重构"
doc_type: "prd"
layer: "PM"
status: "active"
version: "1.0.0"
last_updated: "2026-04-21"
owners:
  - "Product"
  - "Design"
  - "Frontend"
tags:
  - "prd"
  - "trace"
  - "observability"
  - "workbench"
  - "reference-driven"
sources:
  - "https://langfuse.com/docs/observability/overview"
  - "https://langfuse.com/images/docs/tracing-overview.png"
  - "https://mlflow.org/docs/latest/genai/tracing/"
  - "https://mlflow.org/docs/latest/assets/images/genai-trace-debug-405f9c8b61d5f89fb1d3891242fcd265.png"
  - "./13-FR-事件流回放与分析.md"
  - "../40-delivery/64-实施计划-执行可观测层详细开发方案.md"
---

# 18-PRD-Trace Workbench参考图拆解与页面重构

## Purpose
把 `Trace Viewer` 从“右栏分析页的延伸版”重定义成一个真正的页面级 `Trace Workbench`。
本文件不是泛泛的竞品分析，也不是直接的实现方案，而是先把目标参考图拆成可执行的页面 PRD，再作为后续开发与截图验收的唯一对齐基线。

## Why This Doc Exists
当前实现已经具备“三栏结构”的雏形，但用户最新截图已经明确证明：

1. 结构虽然变成了三栏，但整体仍然是“柔和大卡片页面”，不像 `Langfuse Trace Detail` 或 `MLflow Trace Debugging`
2. 中间主体仍然更像卡片列表，而不是 `trace table / waterfall workbench`
3. 右侧 `Inspector` 仍然更像“统计卡 + 摘要区”，不像真正的调试面板
4. 顶部仍然过度强调大数字卡片，缺少 reference UI 那种“紧凑、专业、分析型”的信息组织
5. 行级信息密度不够，导致“有数据但看起来不专业、不像 trace 产品”

因此，本次不能继续靠局部改动逼近目标，必须先把目标图拆解成：

- 布局层
- 组件层
- 信息层
- 交互层
- 验收层

然后再按 PRD 开发。

## Source Registry
本轮只认以下四个参考源：

1. `Langfuse` 官方 Trace Detail 参考图
   [Langfuse Observability Overview](https://langfuse.com/docs/observability/overview)
   [Trace Detail Image](https://langfuse.com/images/docs/tracing-overview.png)

2. `MLflow` 官方 Trace Debugging 参考图
   [MLflow GenAI Tracing](https://mlflow.org/docs/latest/genai/tracing/)
   [Trace Debugging Image](https://mlflow.org/docs/latest/assets/images/genai-trace-debug-405f9c8b61d5f89fb1d3891242fcd265.png)

3. 当前产品已有的执行可观测需求
   [13-FR-事件流回放与分析.md](./13-FR-%E4%BA%8B%E4%BB%B6%E6%B5%81%E5%9B%9E%E6%94%BE%E4%B8%8E%E5%88%86%E6%9E%90.md)

4. 当前工程已经沉淀的执行可观测开发方案
   [64-实施计划-执行可观测层详细开发方案.md](../40-delivery/64-%E5%AE%9E%E6%96%BD%E8%AE%A1%E5%88%92-%E6%89%A7%E8%A1%8C%E5%8F%AF%E8%A7%82%E6%B5%8B%E5%B1%82%E8%AF%A6%E7%BB%86%E5%BC%80%E5%8F%91%E6%96%B9%E6%A1%88.md)

## Target Definition
本次目标不是“做一个新页面”，而是做一个满足以下定义的页面：

- 它必须首先像 `Trace Product`
- 它必须默认服务于“复盘、分析、调试”，不是“聊天阅读”
- 它必须能承载大体量 session，而不会因为节点多就失控
- 它必须让用户在第一页就理解：`看什么`、`点哪里`、`为什么慢/为什么错`

## Reference Merge Strategy
两张目标图不是二选一，而是取长合并：

### 取自 Langfuse 的部分
- 页面级 `Trace Detail` 视角
- 左侧目录 / span tree / trace tree 的“导航感”
- 顶部元信息栏和轻量标签
- 右侧 `Input / Output / Metadata` 型详情区
- 整体“偏专业工具，而不是内容产品”的视觉秩序

### 取自 MLflow 的部分
- 中间时间轴 / waterfall 语义
- span 条形块的时序表达
- Debugging 气质强、结构清晰的 inspector
- 输入输出分区的工程感

### 我们保留自己的部分
- 左侧主应用导航仍然是工作区 / 会话列表
- 界面文案继续使用简体中文
- 数据模型继续基于 `buildActivityRailModel(...)`
- 入口继续从会话页进入 `Trace Viewer`

## Current Deviation Diagnosis
以下偏差直接来自用户最新截图的观察结果，是后续整改的硬约束：

### D-01 顶部区偏差
- 当前顶部是一组体量较大的柔和统计卡
- 参考图顶部更像“工具栏 + 标签行 + 紧凑状态摘要”
- 当前顶部抢占视觉重心，导致用户第一眼看到的是“大盘”，不是 trace 本身

### D-02 左侧区偏差
- 当前左栏仍然像两张独立卡片：`执行目录` + `上下文与洞察`
- 参考图左侧更像一个持续可浏览的导航区，而不是多个营销式卡片
- 当前左栏卡片感太强，缺少 tree / outline / trace navigator 的连贯结构

### D-03 中间主体偏差
- 当前主体仍然是“大白卡里面放列表”
- 行高偏大，圆角过多，阴影过重
- 节点行不像 `trace row`，更像内容卡片
- 时序表达不够主导，waterfall 没成为主阅读对象
- 某些摘要在狭窄列里出现接近“竖排挤压”的观感

### D-04 右侧 Inspector 偏差
- 当前 inspector 仍然先展示四个统计卡，再看详情
- 参考图中 inspector 的核心是内容和结构，不是统计卡
- 当前详情更像“摘要面板”，不像调试面板

### D-05 整体视觉偏差
- 当前仍然是“大圆角 + 柔和阴影 + 大面积留白”的工作台美术风格
- 参考图更偏向“工具产品”，强调秩序、密度、对齐、表格和调试语义
- 当前的视觉调性更像产品首页，不像 observability console

## Product Thesis
`Trace Workbench` 必须满足以下一句话：

> 用户进入页面后，不需要先读说明，就能自然地从左到右完成 `定位范围 -> 浏览执行 -> 检查详情`。

## Information Architecture
页面只允许三块主区域：

1. `Trace Topbar`
2. `Trace Navigator`
3. `Trace Main`
4. `Trace Inspector`

其中 `Trace Main` 内部再分为：

1. `Trace Toolbar`
2. `Trace Table Header`
3. `Trace Table / Waterfall Rows`

## Layout Spec

### Global Layout
- 页面为独立分析页，不再嵌入聊天滚动容器
- 外层背景应为低对比中性灰，不再强调白色大卡
- 页面主体使用 `3-column` 布局

### Column Width
- 左列：`260px ~ 300px`
- 中列：`自适应，优先吃满`
- 右列：`340px ~ 380px`

### Height Behavior
- 页面主体必须吃满剩余可视高度
- 左列自己滚动
- 中列自己滚动
- 右列 inspector 自己滚动
- 顶部区固定，不能跟着中间表格一起滚

### Visual Tokens
- 主容器圆角：`12px ~ 16px`
- 行级圆角：`10px ~ 12px`
- 避免 `20px+` 的大圆角
- 阴影只保留极弱分层阴影
- 边框优先，阴影辅助
- 默认底色比聊天页更冷、更中性

## Page Component Tree

```mermaid
graph TD
  A["TraceWorkbenchPage"] --> B["TraceTopbar"]
  A --> C["TraceBody"]
... (truncated)
```
