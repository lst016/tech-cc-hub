# doc/20-specs/31-工作流Markdown规范.md

> 模块：`doc` · 语言：`markdown` · 行数：412

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
---
doc_id: "31-WFMD"
title: "31-工作流Markdown规范"
doc_type: "contract"
layer: "L2"
status: "active"
version: "1.0.0"
last_updated: "2026-04-21"
owners:
  - "CLAW Core"
tags:
  - "claw"
  - "docs"
  - "1.0.0"
  - "L2"
  - "contract"
  - "workflow"
  - "markdown"
---

# 31-工作流Markdown规范

## Purpose
定义聊天内置工作流所使用的 Markdown 源文件结构、字段约束、解析规则和运行时边界。

这份规范的目标是把工作流写法固定下来，让以下几层都能共用同一份协议：
- 系统级工作流模板
- 用户级工作流模板
- 项目级工作流模板
- Session 绑定的工作流副本
- 后续的解析器、编辑器和执行器

## Scope
本文覆盖：
- Workflow Markdown 的文件结构
- Frontmatter 字段
- 固定章节与步骤块格式
- 解析与校验规则
- 源文件与运行时状态的边界

本文不覆盖：
- UI 具体布局
- 工作流执行引擎实现细节
- 多 Agent 编排策略

## Actors / Owners
- Owner: Runtime + Product
- Readers: Frontend、主进程、模板维护者、解析器实现者

## Inputs / Outputs
- Inputs:
  - 工作流 Markdown 文件
  - 用户在聊天中编辑后的 Markdown
- Outputs:
  - `WorkflowSpecDocument`
  - `WorkflowStepSpec[]`
  - `SessionWorkflowState`

## Core Concepts
- `Source Workflow Markdown`
  - 工作流的源定义文件
  - 面向人编辑，也面向系统解析
  - 不承载运行时状态

- `Session Workflow Copy`
  - 某个 Session 当前绑定的工作流副本
  - 可以来源于系统级、用户级、项目级模板

- `Runtime Workflow State`
  - 当前步骤、执行结果、最近运行时间、失败原因等运行时信息
  - 必须存储在代码侧状态中，而不是直接写回源 Markdown

- `Workflow Step Spec`
  - 对某一步骤“应该做什么”的静态定义

- `Workflow Step State`
  - 对某一步骤“现在做到哪了”的动态状态

## Design Principles
### 1. Markdown 是源，不是数据库
工作流 Markdown 负责定义：
- 目标
- 规则
- 步骤
- 执行意图

工作流 Markdown 不负责保存：
- 当前是否 running
- 最近一次结果
- 上次执行时间
- 失败次数

这些属于运行时状态，必须单独存。

### 2. 写法必须对人友好，对机稳定
规范必须同时满足：
- 用户肉眼可读
- 用户可以直接编辑
- 解析器可以稳定提取结构

因此不采用复杂 DSL，只采用：
- YAML frontmatter
- 固定章节标题
- 固定步骤标题
- 步骤元信息 YAML 块
- 步骤正文 Markdown

### 3. 先固定最小子集
MVP 阶段只支持一个稳定子集。
不在首版规范里加入：
- 条件分支
- 循环
- 并行步骤
- 嵌套子工作流
- 跨工作流引用

## Behavior / Flow
### 文件整体结构
一个合法的 Workflow Markdown 文件必须按以下顺序组织：

1. YAML frontmatter
2. 一个一级标题 `#`
3. 固定章节
4. `## 步骤`
5. 若干个 `### STEP-*` 步骤块

推荐结构如下：

```md
---
workflow_id: "bugfix-basic"
name: "基础问题修复流程"
version: "1.0.0"
scope: "project"
mode: "single-thread"
entry: "manual"
owner: "user"
auto_advance: false
tags:
  - "bugfix"
  - "engineering"
---

# 基础问题修复流程

## 目标
定位问题、完成修复、验证结果、整理结论。

## 适用范围
适用于单项目、单主 Agent 的常规问题修复场景。

## 使用规则
- 当前工作流运行在单线程聊天中
- 用户可以随时中断、编辑和重试
- 一次只推进一个步骤

## 输入上下文
- 当前聊天记录
- 当前工作区代码
- 用户补充说明

## 输出产物
- 修改结果
- 验证结论
- 最终说明

## 步骤

### STEP-1
```yaml
id: "STEP-1"
title: "定位问题"
executor: "primary-agent"
intent: "inspect"
user_actions: ["run", "skip", "edit"]
done_when: "找到明确根因或排查方向"
```
先读日志和代码，不直接修改文件。

### STEP-2
```yaml
id: "STEP-2"
title: "实施修复"
executor: "primary-agent"
intent: "implement"
user_actions: ["run", "edit"]
done_when: "完成必要修改"
```
只改必要文件，不扩大范围。

### STEP-3
```yaml
id: "STEP-3"
title: "验证结果"
executor: "primary-agent"
intent: "verify"
user_actions: ["run", "retry", "skip"]
done_when: "关键验证通过或确认剩余风险"
```
优先做最小验证，再补充说明。

### STEP-4
```yaml
id: "STEP-4"
title: "整理输出"
executor: "primary-agent"
intent: "deliver"
user_actions: ["run", "edit"]
done_when: "输出结果、风险和后续建议"
```
输出最终说明，结束本次流程。
```

## Interfaces / Types
### A. Frontmatter 规范
Frontmatter 必须是文件起始处的 YAML block。

#### 必填字段
| Field | Type | Meaning |
|---|---|---|
| `workflow_id` | string | 工作流稳定唯一标识 |
| `name` | string | 工作流显示名称 |
| `version` | string | 工作流版本号 |
| `scope` | enum | `system \| user \| project \| session` |
| `mode` | enum | 当前首版固定为 `single-thread` |
| `entry` | enum | 当前首版固定为 `manual` |
| `owner` | string | 维护责任人或归属方 |

#### 可选字段
| Field | Type | Meaning |
|---|---|---|
| `description` | string | 对工作流的补充说明 |
| `auto_advance` | boolean | 是否允许在一步完成后自动推进到下一步 |
| `tags` | string[] | 标签集合 |
| `extends` | string | 预留字段，首版只保留，不解析继承 |

### B. 固定章节规范
首版建议支持以下章节：

| Section | Required | Meaning |
|---|---|---|
| `## 目标` | yes | 这套工作流要解决什么问题 |
| `## 适用范围` | no | 适合哪些场景 |
| `## 使用规则` | yes | 执行约束 |
| `## 输入上下文` | no | 依赖哪些输入 |
| `## 输出产物` | no | 希望输出什么 |
| `## 步骤` | yes | 步骤定义区 |

除 `## 步骤` 外，其他正文按普通 Markdown 保留。

### C. 步骤块规范
每个步骤块必须满足：

1. 使用三级标题 `### STEP-*`
2. 标题下紧跟一个 `yaml` 代码块
3. YAML 块后为该步骤正文说明
4. 正文说明一直持续到下一个步骤或文件结束

#### 步骤元信息必填字段
| Field | Type | Meaning |
|---|---|---|
| `id` | string | 步骤唯一标识，必须与标题对应 |
| `title` | string | 步骤显示标题 |
| `executor` | enum | 当前首版固定为 `primary-agent` |
| `intent` | enum | `inspect \| implement \| verify \| deliver \| other` |
| `done_when` | string | 完成判定标准 |

#### 步骤元信息可选字段
| Field | Type | Meaning |
|---|---|---|
| `user_act
... (truncated)
```
