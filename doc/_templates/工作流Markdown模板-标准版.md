---
doc_id: "WORKFLOW-MD-TEMPLATE"
title: "工作流Markdown模板-标准版"
doc_type: "template"
layer: "meta"
status: "template"
version: "1.0.0"
last_updated: "2026-04-21"
owners:
  - "CLAW Core"
tags:
  - "claw"
  - "docs"
  - "1.0.0"
  - "template"
  - "workflow"
  - "markdown"
---

# 工作流Markdown模板-标准版

```md
---
workflow_id: "replace-me"
name: "替换成工作流名称"
version: "1.0.0"
scope: "session"
mode: "single-thread"
entry: "manual"
owner: "user"
auto_advance: false
tags:
  - "demo"
---

# 替换成工作流名称

## 目标
一句话说明这套工作流要解决什么问题。

## 适用范围
说明这套工作流适合哪些场景，不适合哪些场景。

## 使用规则
- 当前工作流运行在单线程聊天中
- 用户可以随时编辑工作流
- 一次只推进一个步骤

## 输入上下文
- 当前聊天记录
- 当前工作区
- 用户补充资料

## 输出产物
- 结果说明
- 关键证据
- 后续建议

## 步骤

### STEP-1
```yaml
id: "STEP-1"
title: "第一步标题"
executor: "primary-agent"
intent: "inspect"
user_actions: ["run", "skip", "edit"]
done_when: "写清楚这一步什么时候算完成"
```
写这一步的执行说明、限制条件和交付预期。

### STEP-2
```yaml
id: "STEP-2"
title: "第二步标题"
executor: "primary-agent"
intent: "implement"
user_actions: ["run", "edit", "retry"]
done_when: "写清楚这一步什么时候算完成"
```
写这一步的执行说明、限制条件和交付预期。

### STEP-3
```yaml
id: "STEP-3"
title: "第三步标题"
executor: "primary-agent"
intent: "verify"
user_actions: ["run", "retry", "skip"]
done_when: "写清楚这一步什么时候算完成"
```
写这一步的执行说明、限制条件和交付预期。

### STEP-4
```yaml
id: "STEP-4"
title: "第四步标题"
executor: "primary-agent"
intent: "deliver"
user_actions: ["run", "edit"]
done_when: "写清楚这一步什么时候算完成"
```
写这一步的执行说明、限制条件和交付预期。
```

## 约束说明
- 源 Markdown 里不要写 `status / last_run_at / last_result`
- 这些属于运行时状态，应该由系统单独存储
- 当前模板默认只支持 `primary-agent`
- 当前模板默认不支持并行步骤和条件分支

## 对应规范
- [31-工作流Markdown规范.md](../20-specs/31-%E5%B7%A5%E4%BD%9C%E6%B5%81Markdown%E8%A7%84%E8%8C%83.md)
