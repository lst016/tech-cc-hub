---
doc_id: "31"
title: "31-Workflow与Skills体系规范"
doc_type: "operations"
layer: "L3"
status: "active"
version: "1.0.0"
last_updated: "2026-04-19"
owners:
  - "CLAW Core"
tags:
  - "claw"
  - "docs"
  - "1.0.0"
  - "L3"
  - "operations"
---

# 31-Workflow与Skills体系规范

## Purpose
定义 CLAW 如何管理可版本化的 `SpecAsset`，并把 workflow 与 skills 作为可持续调优的核心资产。

## Scope
本文件覆盖 asset 分类、生命周期、引用关系和调优闭环。

## Actors / Owners
- Owner: Product + Runtime
- Readers: 调优者、集成实现者、未来的工作流维护者

## Inputs / Outputs
- Inputs: 用户偏好、任务模板、prompts、policies、运行时 evidence
- Outputs: workflow specs、skill packs、policy sets、revision history

## Core Concepts
- `WorkflowSpec`: 一类任务的流程定义。
- `SkillPack`: 特定能力或领域调优集合。
- `PromptAsset`: 可复用提示资产。
- `PolicyAsset`: 权限、预算、拆分等规则。
- `SpecRevision`: 一次明确的资产变更记录。

## Behavior / Flow
推荐分层：

| Asset Type | Purpose |
|---|---|
| `workflow` | 规定大流程和节点责任 |
| `skills` | 提供领域能力、操作手册和触发约定 |
| `prompts` | 提供文本策略和模板 |
| `policies` | 提供预算、权限、拆分和合并规则 |

调优闭环：
1. 从回放和分析中找出失败模式。
2. 定位是 workflow、skill、prompt 还是 policy 问题。
3. 生成新的 `SpecRevision`。
4. 新版本在后续 Session 中被引用并再次验证。

资产选型规则：

| When You Need | Use | Reason |
|---|---|---|
| 一类任务的步骤、依赖和角色协作方式稳定重复出现 | `workflow` | 它表达的是流程结构，而不是局部技巧 |
| 某个领域能力、操作套路或经验需要被复用 | `skills` | 它表达的是能力包和执行手册 |
| 某段语言策略或提示模板需要反复复用 | `prompts` | 它表达的是文本策略，不应承载流程治理 |
| 预算、权限、拆分、合并等规则要被统一治理 | `policies` | 它表达的是系统约束，而不是任务内容 |

资产提升原则：
- 只在某类问题重复出现且能被证明改善结果时，才把经验提升为正式 `SpecAsset`
- 不要把一次性的 prompt 偶然成功直接升级为 workflow
- 先判断失败是“流程问题”还是“能力问题”，再决定写 workflow 还是 skill
- 若一个经验主要在限制系统边界，应优先进入 policy，而不是 skill

## Interfaces / Types
`SpecAsset` 最少需要：
- `asset_id`
- `asset_type`
- `version`
- `owner`
- `applies_to`
- `content_ref`
- `change_reason`

## Failure Modes
- 如果 workflow 和 skill 没有版本号，就无法把改进与运行效果关联。
- 如果调优只改 prompt 不改 policy，系统会长期重复同类失控行为。

## Observability
- 记录某次 Session 使用了哪些 SpecAsset 版本。
- 记录某个分析结论最终指向了哪次 SpecRevision。

## Open Questions / ADR Links
- 未来是否支持 UI 内编辑 SpecAsset，需要单独 ADR。
- 价值验证和用户目标见 [04-问题定义与成功指标.md](../00-overview/04-%E9%97%AE%E9%A2%98%E5%AE%9A%E4%B9%89%E4%B8%8E%E6%88%90%E5%8A%9F%E6%8C%87%E6%A0%87.md)
