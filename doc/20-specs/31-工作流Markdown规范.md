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
| `user_actions` | enum[] | `run \| skip \| edit \| retry` |
| `depends_on` | string[] | 依赖的前置步骤 ID，首版仅校验，不做复杂图调度 |
| `tools_hint` | string[] | 建议使用的工具名 |
| `notes` | string | 给执行器的额外说明 |

#### 步骤正文
步骤 YAML 块后的正文说明必须是普通 Markdown。
它用于表达：
- 执行要求
- 限制条件
- 风险提示
- 交付标准补充

### D. 运行时对象建议
Markdown 解析后建议落成以下结构：

```ts
type WorkflowSpecDocument = {
  workflowId: string;
  name: string;
  version: string;
  scope: "system" | "user" | "project" | "session";
  mode: "single-thread";
  entry: "manual";
  owner: string;
  autoAdvance: boolean;
  sections: {
    goal: string;
    scopeText?: string;
    rules: string;
    inputs?: string;
    outputs?: string;
  };
  steps: WorkflowStepSpec[];
  rawMarkdown: string;
};

type WorkflowStepSpec = {
  id: string;
  title: string;
  executor: "primary-agent";
  intent: "inspect" | "implement" | "verify" | "deliver" | "other";
  doneWhen: string;
  userActions?: Array<"run" | "skip" | "edit" | "retry">;
  dependsOn?: string[];
  toolsHint?: string[];
  notes?: string;
  body: string;
};

type SessionWorkflowState = {
  workflowId: string;
  sourceLayer: "system" | "user" | "project" | "session";
  sourcePath?: string;
  currentStepId?: string;
  status: "idle" | "running" | "completed" | "failed";
  steps: Array<{
    stepId: string;
    status: "pending" | "running" | "completed" | "skipped" | "failed";
    lastRunAt?: number;
    lastResultSummary?: string;
    failureReason?: string;
  }>;
};
```

## Parsing Rules
### 必须满足
- 文件必须包含合法 frontmatter
- 文件必须包含一个一级标题 `#`
- 文件必须包含 `## 步骤`
- 至少包含一个步骤块
- 步骤 `id` 必须唯一
- 步骤标题必须与 YAML `id` 一致
- `depends_on` 中引用的步骤必须存在

### 应该满足
- 步骤顺序与 `STEP-1 / STEP-2 / STEP-3` 自然顺序一致
- `intent` 与步骤正文语义一致
- `done_when` 使用清晰可判断的描述

### 忽略策略
为保证向前兼容，解析器对未知 frontmatter 字段、未知章节、未知步骤可选字段：
- 保留原文
- 不阻断解析
- 在严格模式下给出 warning

## Source / Runtime Boundary
以下字段不得写入源工作流 Markdown：
- `status`
- `current_step`
- `last_run_at`
- `last_result`
- `failure_reason`
- `retry_count`

这些字段如果需要展示，必须来自运行时状态。

如果未来需要“导出带状态的工作流快照”，也必须使用另一种产物类型，例如：
- `WorkflowRunSnapshot`
- `WorkflowSessionExport`

不能反向污染源模板。

## Failure Modes
- 如果把运行状态写回源 Markdown，模板会越来越脏，无法复用
- 如果步骤格式允许随意变化，解析器会非常脆弱
- 如果 `done_when` 不清晰，自动推进会失真
- 如果步骤 ID 不稳定，日志、事件和分析就无法对齐

## Observability
建议在工作流执行中记录：
- `workflow.bound`
- `workflow.parsed`
- `workflow.validation_failed`
- `workflow.step.started`
- `workflow.step.completed`
- `workflow.step.failed`
- `workflow.step.skipped`
- `workflow.unbound`

事件中至少应携带：
- `session_id`
- `workflow_id`
- `step_id`
- `source_layer`
- `source_path`

## Recommended Implementation Order
1. 先按本文实现 Markdown 解析与校验
2. 再实现 `SessionWorkflowState`
3. 再把当前步骤注入聊天上下文
4. 最后再做 UI 编辑器与模板管理

## Open Questions / ADR Links
- 是否需要额外定义 `WorkflowRunSnapshot` 的 Markdown 导出格式
- 是否允许 `depends_on` 在未来扩展为图结构
- 相关文档：
  - [26-存储与Markdown产物规范.md](./26-%E5%AD%98%E5%82%A8%E4%B8%8EMarkdown%E4%BA%A7%E7%89%A9%E8%A7%84%E8%8C%83.md)
  - [28-关键对象最小Schema.md](./28-%E5%85%B3%E9%94%AE%E5%AF%B9%E8%B1%A1%E6%9C%80%E5%B0%8FSchema.md)
  - [38-聊天内置工作流方案.md](../30-operations/38-%E8%81%8A%E5%A4%A9%E5%86%85%E7%BD%AE%E5%B7%A5%E4%BD%9C%E6%B5%81%E6%96%B9%E6%A1%88.md)
