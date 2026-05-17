# Agent 执行页 v1 事故报告

日期：2026-05-17
状态：已封存，本版本不进入产品
封存 patch：`docs/superpowers/archive/agent-execution-cards-v1/agent-execution-cards-v1.patch`

## 结论

这版 Agent 执行页不应该继续交付。它没有稳定满足用户要的「和聊天记录一样的、某个 Agent 的完整原始执行内容」，而是多次滑向「工具调用摘要 / Agent run 汇总 / 低信息状态卡」。在真实页面里，`TaskList` 这类团队任务列表工具也被误展示为 `AGENT TRANSCRIPT`，造成“看起来有详情，实际没有详情”的误导。

正确策略是：如果拿不到真实、完整、可复用聊天渲染的 Agent transcript，就不要显示这个 Agent 页。

## 用户真实需求

用户希望复刻的是 Qoder 右侧 tab 的行为：

- 左侧聊天中出现一个 Agent 执行记录。
- 点击后右侧新开一个以该 Agent 命名的 tab。
- tab 内显示该 Agent 的完整原始执行流，视觉和内容都接近聊天记录。
- 多个 subagent / Agent Team 成员可以有多个独立 tab。
- 不需要总览，不需要二次摘要，不需要低信息状态页。

## 实际偏差

本版实现经历了三个偏差：

1. 最初把需求理解成「Agent 执行卡片总览」，做成了右侧卡片列表。
2. 后来改成动态 tab，但仍然依赖 `activity-rail-model` 汇总出的 `agentRuns`，不是直接以真实嵌套 transcript 为数据源。
3. 最后虽然改为复用 `MessageCard`，但数据关联仍靠推断 `tool_use_id` / timeline id。真实场景里 `TaskList`、创建回执、仍在运行状态等低信息工具也会被包装成 Agent 页。

结果是：UI 给了用户一个“可以看详细执行内容”的入口，但实际内容并不详细。

## 根因

- 没先把数据契约钉牢：没有确认 SDK / runner 是否能提供某个 subagent 的完整原始 message stream。
- 用推断代替事实：从 `TaskCreate`、`TaskGet`、`TaskList`、timeline 节点反推 Agent 执行页，导致列表/状态类工具被误纳入。
- 验收用例过于乐观：早期 smoke 只验证“能打开多个 tab”，没有验证“里面是否是足够详细的原始执行内容”。
- 需求判断失焦：用户一直要的是「像聊天记录一样的执行内容」，实现却反复补摘要、指标、节点数、状态标签。

## 影响

- 在真实 UI 中出现了 `AGENT TRANSCRIPT / 查看团队任务列表` 这种假详情页。
- 用户需要反复纠偏，降低了对该功能方向的信任。
- 如果继续打磨这版，会继续在错误数据模型上叠 UI，风险高于收益。

## 封存范围

封存 patch 包含这波实现的所有相关改动：

- `src/shared/activity-rail-model.ts`
- `src/ui/App.tsx`
- `src/ui/components/ActivityRail.tsx`
- `src/ui/components/ActivityWorkspaceTabs.tsx`
- `src/ui/components/EventCard.tsx`
- `src/ui/events.ts`
- `src/ui/render/markdown.tsx`
- `src/ui/utils/activity-workspace-tabs.ts`
- `src/ui/utils/agent-transcript.ts`
- `test/electron/activity-rail-model.test.ts`
- `test/electron/activity-workspace-tabs.test.ts`
- `test/electron/agent-transcript.test.ts`
- `scripts/qa/agent-execution-cards-smoke.cjs`
- `package.json`
- `docs/superpowers/specs/2026-05-16-agent-execution-cards.md`
- `docs/superpowers/plans/2026-05-16-agent-execution-cards.md`

## 本次撤回动作

- 保留完整 patch 到 archive 目录。
- 产品代码回退到不包含 Agent 执行页 v1 的状态。
- 原始 spec / plan 文件不作为当前版本文档继续保留，只保留在 patch 里。
- 事故报告作为后续重新设计的约束文档保留。

## 重新启动条件

下一版只有满足下面条件才值得重新做：

- runner 层能明确提供 `agentRunId -> raw messages[]`，不是 UI 自己从工具名和 timeline 推断。
- subagent / Agent Team 成员的内部消息、工具调用、工具返回有稳定 parent id。
- UI 只负责渲染原始 transcript，不生成执行摘要。
- 如果 transcript 不存在或低信息，入口不显示。
- 验收用真实会话 fixture，必须包含：子 Agent 文本、内部工具调用、工具返回、完成输出。

## 下一版建议

v2 不要先做页面。先做数据探针：

1. 捕获一次真实 Agent Team / subagent 会话的原始 SDK event stream。
2. 标出哪些事件能唯一归属到某个 agent。
3. 建一个只读 `AgentTranscriptStore`，输入 session messages，输出可渲染 transcript。
4. 只有 transcript 达到详细阈值时，聊天流才显示「打开 Agent」入口。
5. 最后再接右侧 tab。

一句话：先证明拿得到详细内容，再显示入口。
