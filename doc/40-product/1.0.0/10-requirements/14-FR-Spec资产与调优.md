---
doc_id: "PRD-100-14"
title: "14-FR-Spec资产与调优"
doc_type: "requirement"
layer: "PM"
status: "active"
version: "1.0.0"
last_updated: "2026-04-19"
owners:
  - "Product"
tags:
  - "claw"
  - "docs"
  - "1.0.0"
  - "requirements"
  - "spec"
---

# 14-FR-Spec资产与调优

## Purpose
定义 workflow / skills / prompts / policies 在 1.0.0 中如何成为正式可治理资产。

## Scope
本文件覆盖 SpecAsset 的创建、附着、复用、版本和调优。

## Actors / Owners
- Owner: Product
- Readers: 产品、前端、后端、调优实现者

## Inputs / Outputs
- Inputs: SpecAsset 体系、回放结论
- Outputs: `FR-SPEC-*`

## Interfaces / Types
`FR-SPEC-001: MUST - 用户可以创建和保存 SpecAsset`
Acceptance Criteria:
- 至少支持 `workflow / skill / prompt / policy` 四类资产
- 每个资产至少有名称、类型、版本、摘要
- 资产可被再次打开查看

`FR-SPEC-002: MUST - 用户可以将 SpecAsset 绑定到 Session 或 TaskNode`
Acceptance Criteria:
- Session 级和 Task 级绑定都必须支持
- 绑定动作进入事件流
- UI 中能看见当前绑定资产

`FR-SPEC-003: MUST - 用户可以查看 SpecAsset 的版本历史`
Acceptance Criteria:
- 每次变更至少记录版本号、时间和说明
- 可以查看当前版本与前一版本的差异摘要
- 删除资产时需明确风险提示

`FR-SPEC-004: SHOULD - 系统可以把 Replay / Analysis 的结论回链到 Spec 修订动作`
Acceptance Criteria:
- 修订时可附带来源 Replay 或 Analysis 链接
- 至少支持人工填写修订原因
- 修订后可以看到“修订前/修订后”的基本对比

`FR-SPEC-005: SHOULD - 用户可以复用已有 SpecAsset 发起相似任务`
Acceptance Criteria:
- 发起新任务时可从历史资产中选择
- 系统能展示资产最近使用时间和次数
- 复用动作写入事件流

`FR-SPEC-006: COULD - 系统可以推荐可能值得复用或修订的资产`
Acceptance Criteria:
- 推荐应明确来源依据
- 推荐必须可被忽略
- 不推荐自动改写资产

## Failure Modes
- 如果 SpecAsset 不能版本化，就只是换了名字的 prompt 收藏夹。
- 如果 Spec 修订不能回链到证据，调优过程将不可追踪。

## Observability
- 必须记录:
  - `spec_created`
  - `spec_bound`
  - `spec_reused`
  - `spec_revised`
  - `spec_compare_viewed`

## Open Questions / ADR Links
- 资产治理策略见 [31-Workflow与Skills体系规范.md](../../../30-operations/31-Workflow%E4%B8%8ESkills%E4%BD%93%E7%B3%BB%E8%A7%84%E8%8C%83.md)
