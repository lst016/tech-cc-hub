---
doc_id: "DOC-SPEC-PREVIEW-PERFORMANCE-ROUND-2"
title: "Preview 性能优化第二轮 Spec"
doc_type: "spec"
layer: "L4"
status: "draft"
version: "0.1.0"
last_updated: "2026-05-31"
owners:
  - "tech-cc-hub Core"
audience:
  - "frontend"
  - "electron"
source_of_truth: false
tags:
  - "tech-cc-hub"
  - "engineering"
  - "preview"
  - "performance"
  - "spec"
---

# Preview 性能优化第二轮 Spec

更新时间：2026-05-31

关联 PR：<https://github.com/lst016/tech-cc-hub/pull/1>

## 背景

第一轮 PR 已经解决预览工作台最明显的全量扫描和首屏加载问题：预览文件扫描有界化、会话/任务 payload 限流、ActivityRail 输入截断、Monaco 首屏 lazy split、slash/skill/background scan 加上硬上限。

第二轮目标不是继续堆功能，而是处理第一轮只“止血”但没有根治的性能债，让大仓库、长会话、频繁切换预览时的体感更接近稳定 IDE。

## 目标

1. 降低 React 全局状态订阅造成的无关重渲染。
2. 将 ActivityRail / SessionAnalysis 的重型模型构建从主交互路径移走。
3. 降低首次打开代码编辑器时 Monaco lazy chunk 带来的顿挫。
4. 给预览、会话列表、分析面板建立可重复的性能预算和回归测试。
5. 确认 CodeGraph 检索链路是否仍存在全量向量算分风险。

## 非目标

- 不重做预览工作台 UI 结构。
- 不新增 VSCode 级功能，例如符号跳转、全局搜索替换、多选批量文件操作。
- 不把 computer-use 作为本轮强制门禁；当前问题是环境拿不到稳定窗口内容。
- 不在本轮大改数据库 schema，除非确认某条查询已经成为实际瓶颈。

## 优先级

| 优先级 | 项目 | 当前状态 | 本轮目标 |
|---|---|---|---|
| P0 | Store selector / rerender containment | 只做了 payload 与部分派生计算缓解 | 减少 App、Sidebar、TaskPanel 的全局订阅面 |
| P0 | ActivityRail / SessionAnalysis 重算 | 输入已截断，但仍在主线程同步构建 | Worker 或增量缓存，避免切换/滚动卡顿 |
| P0 | 性能预算与测试证据 | 有 smoke，无细粒度预算 | 加入可重复的 perf contract tests |
| P1 | Monaco 打开时顿挫 | 首屏已 lazy split，打开编辑器仍加载大 chunk | idle prefetch / read-only fallback / 加载状态优化 |
| P1 | CodeGraph 检索链路 | 未深修，只在扫描报告中标记 | 确认 CodeGraph active path，并建立性能边界 |

## 设计方案

### 1. Store selector / rerender containment

问题：

- `src/ui/App.tsx` 同时订阅大量 store 字段，active session 更新容易扩大重渲染面。
- `src/ui/components/Sidebar.tsx` 直接 `Object.values(sessions)` 并排序，长会话列表下每次 store 变动都会重新派生。
- `src/ui/components/TaskPanel.tsx` 同时读 sessions / archivedSessions / config，workspace 候选派生成本随会话数增长。

方案：

- 新增 `src/ui/store/selectors/`，把高频 selector 从组件里抽出。
- 增加 `selectActiveSessionViewState`，只返回渲染当前聊天所需字段。
- 增加 `selectSidebarSessionSummaries`，使用 summary session 字段，避免读取完整 messages。
- 增加 `selectWorkspaceCandidates`，只依赖 cwd/session cwd，而不是完整 session 对象。
- 对 session list 维护轻量 ordered id list，避免每次 UI 渲染重新 `Object.values().sort()`。

验收：

- active session 新增 stream message 时，Sidebar session list 不因为完整 messages 引用变化而重算。
- 非 active session 更新时，App 主聊天区不重建 display model。
- 1000 个 session summary 的排序派生成本可被测试固定在 O(n) 更新路径，不能在单次 render 内多次全量排序。

### 2. ActivityRail / SessionAnalysis worker 化

问题：

- 第一轮通过 `limitActivityRailSessionMessages` 控制输入长度，但 `buildActivityRailModel` 仍是同步模型构建。
- 长会话切换 ActivityRail 或 SessionAnalysis 时，仍可能阻塞主线程。

方案：

- 新增 `activity-rail.worker.ts`，把 `buildActivityRailModel` 放入 worker。
- UI 层引入 `useActivityRailModel` hook：
  - 输入 `sessionId`、`messagesRevision`、`permissionRequestsRevision`。
  - 使用 request token 防止旧 worker 结果覆盖新会话。
  - 首屏先显示轻量 fallback model，再异步替换完整分析结果。
- SessionAnalysis 复用同一 hook，避免两处重复构建。
- 为 worker 失败保留同步 fallback，但只在测试或异常场景使用。

验收：

- 5000 条消息的 synthetic session，切到 ActivityRail 不应同步调用完整 `buildActivityRailModel`。
- 快速切换两个 session 时，旧 session worker 结果不能覆盖当前 session。
- worker 不可用时页面仍可降级显示，不白屏。

### 3. Monaco 打开时性能

问题：

- 第一轮已把 Monaco 从预览 pane 首屏拆出，但首次打开代码文件仍会加载大 chunk。

方案：

- 首屏空闲后使用 `requestIdleCallback` / timeout 预取 `PreviewMonacoEditor`。
- 对小型只读文件优先显示轻量 code view，用户编辑或文件可写时再升级到 Monaco。
- Monaco loading 状态明确展示“编辑器加载中”，避免误判为卡死。
- 记录 `preview.monaco.load.start/end` perf mark。

验收：

- 不打开文件时，Monaco 不进入首屏主 chunk。
- 打开第一个代码文件时有明确 loading 状态。
- 空闲预取开启后，第二次打开代码文件不重复触发 chunk load。

### 4. 性能预算与回归测试

问题：

- 当前通过 `qa:preview` 证明功能可用，但缺少对“不要再全量扫描/重算”的预算约束。

方案：

- 新增 `test/electron/performance-budget.test.ts` 或按模块拆分：
  - session list 不能返回完整 messages。
  - preview quick open scan 必须遵守数量和时间预算。
  - ActivityRail UI hook 不允许在 render 阶段同步构建大模型。
  - Monaco 仍必须保持 lazy import。
- `qa:preview` 输出保留 `PREVIEW_QA_OK`，额外打印关键耗时摘要，不把本地机器绝对耗时作为硬门禁。
- 对 bundle 输出增加轻量检查：Aion preview pane chunk 不得重新包含 Monaco。

验收：

- 性能预算测试在 CI/本地可重复，不依赖真实大仓库。
- 失败信息要指出具体预算项，而不是只报超时。

### 5. CodeGraph 检索确认

问题：

- 第一轮扫描提到“全量向量算分 + sort”风险，但当前代码中 legacy vector knowledge 已显示 disabled，需要确认实际仍在运行的 CodeGraph 入口。

方案：

- 梳理当前 active CodeGraph search path。
- 如果 legacy path 已完全 disabled，新增防回归测试确保不会被普通 workflow 调用。
- 如果仍有 active 全量向量算分：
  - 增加 topK early cutoff 或候选预过滤。
  - 将全量 sort 改为 bounded heap / partial ranking。
  - 对大输入加最大候选数和耗时日志。

验收：

- 有明确文档说明当前 active 检索路径。
- 任一 active search path 都必须有 topK / candidate limit。
- 不能在普通预览或 session list 切换时触发向量检索。

## TDD 顺序

1. 先写 store selector contract tests：session message 更新不应改变 sidebar summary 派生引用。
2. 再写 ActivityRail worker hook tests：大 session 不同步 build，旧结果不覆盖新 session。
3. 写 Monaco lazy/prefetch contract：首屏不 import Monaco，idle 后允许预取。
4. 写 performance budget tests：session list payload、quick open scan、bundle split。
5. 最后做 CodeGraph active path tests。

## 冒烟测试

本轮实现完成后至少跑：

```bash
npm run build
npm run qa:preview
npx tsc --project test/electron/tsconfig.json
node --test dist-test/test/electron/performance-budget.test.js
```

如果新增 worker/hook 测试，补充对应 dist test 命令。

## 人工测试重点

- 大仓库启动后，切换 Sidebar 会话列表是否还有明显卡顿。
- 长会话切 ActivityRail / SessionAnalysis 是否还有明显白屏或输入阻塞。
- 第一次打开代码文件是否有明确加载反馈；第二次打开是否更快。
- 输入 `@` file mention、`Cmd+P` Quick Open 不应重新扫 generated/dependency 目录。

## 完成定义

- PR 中必须列出每个 P0 的测试证据。
- 本轮至少完成 P0 三项：selector/rerender、ActivityRail 异步化、性能预算测试。
- P1 如果不能完成，需要在 PR 里说明是“确认无 active 风险”还是“延期实现”。
- 不允许只用“体感变快”作为结论，必须有自动化或 perf mark 证据。
