# doc/30-operations/38-聊天内置工作流方案.md

> 模块：`doc` · 语言：`markdown` · 行数：349

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
---
doc_id: "38"
title: "38-聊天内置工作流方案"
doc_type: "operations"
layer: "L3"
status: "active"
version: "1.0.0"
last_updated: "2026-04-21"
owners:
  - "CLAW Core"
tags:
  - "claw"
  - "docs"
  - "1.0.0"
  - "L3"
  - "operations"
  - "workflow"
  - "chat"
---

# 38-聊天内置工作流方案

## Purpose
定义一种适合当前 `chat-first` 产品形态的内置工作流方案。
目标不是立刻做成多 Agent 编排器，而是先在单线程聊天里引入“可编辑、可执行、可追踪”的 Markdown 工作流，让用户能自己操作、调整和复用。

## Scope
本文覆盖：
- 当前单线程聊天下的工作流定位
- Markdown 工作流格式
- 工作流来源分层
- 聊天内的执行与交互方式
- MVP 与后续演进路线

本文不覆盖：
- 多 Agent 并行调度
- 独立工作流引擎 DSL
- 云端工作流市场与远程分发

## Actors / Owners
- Owner: Product + Runtime + Frontend
- Readers: 前端、主进程、工作流设计者、模板维护者

## Inputs / Outputs
- Inputs:
  - 当前聊天 Session
  - 用户选择的工作流模板
  - 用户在聊天中对工作流的编辑和操作
- Outputs:
  - 绑定到 Session 的工作流 Markdown
  - 工作流步骤状态
  - 工作流执行日志与会话事件

## Core Concepts
- `Primary Interactive Agent`
  - 当前聊天仅绑定一个主交互 Agent。
  - 该 Agent 串行执行，不在聊天主链路中并行拉起多个 agents。

- `Workflow Markdown`
  - 工作流以 Markdown 保存，用户可直接阅读、编辑、复制和复用。
  - Markdown 是用户可操作的主视图，也是 MVP 阶段的主要配置载体。

- `Workflow Template`
  - 可被复用的工作流模板，不直接等于某次运行实例。

- `Session Workflow`
  - 某个聊天 Session 当前实际绑定的工作流内容。
  - 可以来自模板，也可以是用户在会话中临时改出来的版本。

- `Workflow Step`
  - 工作流中的最小可执行单元。
  - 每一步只表达“下一步要做什么”，不要求内部分裂出多个 agents。

## Behavior / Flow
### 1. 先承认当前现实
当前聊天主链路应被定义为：

`一个 Session = 一个主交互 Agent = 一条串行执行链路`

这意味着：
- 聊天里的工作流本质上是“给同一个 Agent 的执行脚本和约束”
- 不是任务图编排器
- 不是多线程 worker 调度器
- 不是先做 agents marketplace 再反推聊天

先把单线程做好，反而更稳：
- 用户理解成本低
- 聊天回放更清晰
- 执行日志更容易和会话对齐
- 出错时更容易人工接管

### 2. 工作流来源分三层
工作流模板建议沿用三层来源，但执行时都落回 Session：

| 层级 | 位置 | 用途 |
|---|---|---|
| 系统级 | 应用内置目录 | 内置维护流程、巡检流程、默认模板 |
| 用户级 | `~/.claude/workflows` | 用户个人常用流程 |
| 项目级 | `<project>/.claude/workflows` | 只对当前项目生效的流程 |

优先级建议：
`项目级 > 用户级 > 系统级`

但无论来源在哪，进入聊天后都要变成：
`当前 Session 绑定的一份 Workflow Markdown`

### 3. 聊天里的工作流运行方式
推荐采用“手动驱动 + Agent 执行”的方式：

1. 用户在聊天中选择一个工作流
2. 系统把该 Markdown 绑定到当前 Session
3. UI 解析出步骤列表
4. 用户点击“运行下一步”或“运行本步”
5. 同一个主 Agent 根据该步骤说明执行
6. 系统把结果写回步骤状态和执行日志
7. 用户可继续下一步、重试、跳过或直接改 Markdown

这里最关键的是：
- 工作流本身是用户可编辑的
- 执行权仍在聊天主 Agent
- 步骤推进权优先在用户手里

### 4. 为什么不用自动多 Agent
对当前阶段，聊天内工作流不建议直接做成多 Agent 自动编排，原因是：
- 会破坏“聊天就是主入口”的心智
- 很容易让日志、状态、上下文归属变乱
- 用户一旦想改流程，中间接管成本会很高
- 你当前的 Agent 系统还不是聊天主链路，硬接进去风险大

更合理的路径是：
- 第一步：单线程工作流
- 第二步：步骤级可选“委托执行”
- 第三步：只有某些步骤允许调用外部 agent

## Interfaces / Types
### A. Markdown 工作流最小格式
建议先支持一种“前言区 + 固定章节 + 步骤块”的 Markdown 结构。

```md
---
workflow_id: "project-bugfix"
name: "项目问题修复流程"
version: "1.0.0"
scope: "project"
mode: "single-thread"
entry: "manual"
owner: "user"
---

# 项目问题修复流程

## 目标
定位问题、完成修复、验证结果、整理结论。

## 使用规则
- 当前工作流运行在单线程聊天中
- 用户可以随时编辑工作流
- 一次只推进一个步骤

## 上下文输入
- 当前项目代码
- 当前聊天记录
- 用户补充说明

## 步骤

### STEP-1
```yaml
title: 定位问题
status: pending
run: agent
user_actions: [run, skip, edit]
done_when: 找到可复现路径或明确根因方向
```
先读代码和日志，不要直接改文件。

### STEP-2
```yaml
title: 实施修复
status: pending
run: agent
user_actions: [run, skip, edit]
done_when: 代码修改完成且本地构建通过
```
基于上一步结论修改代码，只改必要文件。

### STEP-3
```yaml
title: 验证结果
status: pending
run: agent
user_actions: [run, skip, edit, retry]
done_when: 关键路径验证通过
```
优先跑最小验证，再补必要说明。

### STEP-4
```yaml
title: 整理输出
status: pending
run: agent
user_actions: [run, edit]
done_when: 输出结果、风险和后续建议
```
总结本次修改内容和验证结果。
```

### B. 解析规则
MVP 阶段只解析以下内容：
- Frontmatter
  - `workflow_id`
  - `name`
  - `version`
  - `scope`
  - `mode`
  - `entry`
- 固定章节
  - `## 目标`
  - `## 使用规则`
  - `## 上下文输入`
  - `## 步骤`
- 步骤块
  - `### STEP-*`
  - 紧随其后的 YAML code block
  - 步骤正文说明

这样做的好处是：
- 对用户仍然是普通 Markdown
- 对系统仍然可结构化解析
- 不需要一开始就做复杂 DSL

### C. Session 内部状态建议
虽然 Markdown 是用户视图，但运行时建议补一份轻量状态：

```ts
type SessionWorkflowState = {
  workflowId: string;
  sourceLayer: "system" | "user" | "project" | "session";
  sourcePath?: string;
  markdown: string;
  currentStepId?: string;
  steps: Array<{
    stepId: string;
    title: string;
    status: "pending" | "running" | "completed" | "skipped" | "failed";
    lastRunAt?: number;
    lastResultSummary?: string;
  }>;
};
```

建议原则：
- Markdown 是用户编辑源
- 解析结果是运行时结构
- 不把运行时状态硬编码回原文每一行
- 需要时再“同步回 Markdown”

## UI / Interaction
聊天内建议增加一个轻量工作流面板，而不是新开复杂页面：

### 入口
- 聊天框上方或右侧显示 `工作流`
- 可执行操作：
  - 选择工作流
  - 新建工作流
  - 编辑 Markdown
  - 运行下一步
  - 运行本步
  - 标记完成
  - 跳过
  - 重试

### 展示
- 上半部分：当前工作流名称、来源层级、模式
- 中间部分：步骤表格
- 下半部分：当前步骤说明、最近一次结果、
... (truncated)
```
