# Prompt Ledger Skill/Workflow 优化工作台设计

## 背景

当前 Trace Viewer 的 `Prompt Ledger` tab 已经能展示真实发送上下文、上下文健康度、Prompt 分布、上下文诊断和优化建议，但实际界面里 `Prompt 分布` 被上方健康卡片和下方固定高度的 `上下文诊断` 挤压到几乎不可见。用户点击左侧 Trace 节点后，右侧上下文诊断的变化也不明显，导致页面不像一个可用于分析 skill / 工作流的工作台。

用户确认的产品目标是：同时支持单次执行节点调试和 skill / workflow 优化，但默认优先服务于 skill / workflow 优化。节点点击应作为定位 prompt 证据的辅助入口，而不是让工具输入输出详情抢占主视图。

## 目标

1. `Prompt 分布` 必须成为 `Prompt Ledger` 的主视图，不能被固定诊断区遮挡或挤没。
2. 默认视角回答：当前 prompt 中项目规则、skills、workflow、memory、history、tool、current input 各占多少，哪些应该保留、压缩、改写或删除。
3. 点击左侧 Trace 节点时，`Prompt Ledger` 能明确联动到该节点相关的 prompt 片段，并展示匹配方式。
4. `上下文诊断` 保留，但作为当前片段的详情视图，不能压缩主表格空间。
5. 页面应能产出可复制的优化建议，用于后续改写 skill / workflow 或下一轮 prompt。

## 非目标

1. 本轮不重做整个 Trace Viewer。
2. 本轮不改变 Prompt Ledger 的采集协议和数据库结构，除非实现时发现现有字段无法表达节点联动。
3. 本轮不引入新的后端服务或 AI 自动改写流程。
4. 本轮不把 Prompt Ledger 拆成独立路由页面，先在现有 `SessionAnalysisPage` 内完成工作台体验。

## 信息架构

`Prompt Ledger` tab 调整为一个优化工作台：

1. 顶部紧凑摘要条
   - 展示真实发送上下文、可压缩候选、风险信号、记录轮次、健康分。
   - 控制为一行或最多两行，不再使用大块健康说明卡占据首屏。

2. 主分布区
   - `Prompt 分布` 是默认主区域。
   - 分布表格至少占据右侧 inspector 可用高度的主要部分。
   - 支持 `当前节点`、`全部片段` 和来源筛选。
   - 当没有选中节点或节点没有命中时，仍然保持表格可见，并给出清晰空状态。

3. 片段诊断区
   - `上下文诊断` 改为右侧详情栏、可折叠侧栏或抽屉式详情。
   - 详情展示当前片段的质量分、相关性、压缩性、动作、证据原文和优化建议。
   - 详情区不能使用固定底部高度挤压 `Prompt 分布`。

4. 优化建议区
   - 保留 `生成摘要`、`加入优化建议`、`复制账本摘要` 等动作。
   - 更突出“这段应该如何处理”：保留、压缩、迁移到 workflow、改写 skill、删除重复历史。

## 节点联动规则

左侧 Trace Flow 点击节点后，右侧 `Prompt Ledger` 应按以下规则更新：

1. 如果当前 tab 是 `Prompt Ledger`
   - 立即切换到该节点作用域。
   - 清空旧的片段选择。
   - 自动选择该节点命中的第一个 prompt 片段。
   - 更新诊断详情。

2. 如果当前 tab 不是 `Prompt Ledger`
   - 保持原 tab 行为不变。
   - 用户切到 `Prompt Ledger` 时，应基于当前节点展示关联片段。

3. 匹配优先级
   - 直接命中：`segment.nodeId` 或 `segment.messageId` 与当前 `timelineItem.id` 匹配。
   - 工具命中：`toolName + round` 匹配。
   - 用户输入命中：当前节点是发送用户输入时，匹配 `current_prompt` 和 `attachment`。
   - 同轮回退：没有直接命中时，展示同 round 的片段。
   - 未命中：没有同轮片段时，展示“未命中”状态，并保留全部分布入口。

4. 视觉反馈
   - 当前节点信息必须显示匹配状态：直接命中、同轮回退、未命中。
   - 分布表中的关联片段要有高亮或关联标识。
   - 诊断详情标题应同步显示当前 Trace 节点或当前片段名称。

## 布局要求

桌面宽屏：

1. 左侧 Trace Flow 保持现有宽度。
2. 右侧 inspector 内部采用上摘要、下工作区结构。
3. 工作区推荐采用 `主表格 + 右详情栏`。
4. 主表格宽度优先，详情栏宽度控制在 320-380px。
5. 如果宽度不足，详情栏可折叠为抽屉，但表格必须保持可用。

较窄窗口：

1. 摘要条变成紧凑换行。
2. 详情栏默认收起，通过选中片段或按钮打开。
3. 表格仍是首要可见内容。

## 数据和组件边界

优先复用现有模型：

1. `src/shared/prompt-ledger.ts`
   - 继续负责构建 prompt ledger bucket 和 segment。
   - 暂不新增采集字段。

2. `src/shared/activity-rail-model.ts`
   - 继续聚合 `promptAnalysis`、`contextDistribution` 和 timeline。
   - 若测试发现节点关联缺失，可在模型层补充纯函数，不把匹配逻辑散在 UI 里。

3. `src/ui/components/SessionAnalysisPage.tsx`
   - 负责 `Prompt Ledger` 工作台布局和交互。
   - 抽出小组件时，优先抽布局组件和纯展示组件，不做大范围重构。

建议新增或强化的 UI 内部概念：

1. `PromptLedgerWorkbench`
   - 顶部摘要、主分布表、详情面板的容器。

2. `PromptLedgerDistributionTable`
   - 只负责片段表格、来源筛选和节点作用域提示。

3. `PromptSegmentDiagnosisPanel`
   - 只负责选中片段诊断和优化动作。

4. `derivePromptNodeScope`
   - 纯函数，输入 `analysis.segments` 和 `selectedTimelineItem`，输出匹配模式、片段集合、token 估算和说明文案。

## 测试策略

先补测试再实现：

1. 模型/纯函数测试
   - 选中节点直接命中时，应返回 `exact`。
   - 选中节点无直接命中但同轮存在片段时，应返回 `round`。
   - 完全无命中时，应返回 `empty`。
   - 切换节点时，默认选中片段应随作用域变化。

2. 静态 UI 结构测试
   - `SessionAnalysisPage.tsx` 应包含 Prompt Ledger 工作台标识。
   - 不再存在固定底部 `h-[340px]` 的上下文诊断区挤压主表格。
   - `Prompt 分布` 和 `上下文诊断` 均保留，但布局语义变为主表格和详情面板。

3. 构建验证
   - `npm run transpile:electron`
   - `node --test dist-electron/electron/activity-rail-model.test.js` 或当前对应测试命令
   - `node --test dist-test/test/electron/session-analysis-page.test.js` 或当前对应测试命令
   - `npm run build`

4. Electron 真窗口验收
   - 打开一条有 Prompt Ledger 的 Trace。
   - 进入 `Prompt Ledger` tab。
   - 确认 `Prompt 分布` 表格在首屏可见，不被底部诊断区遮挡。
   - 点击左侧不同节点，确认当前节点匹配状态、表格内容和诊断详情同步变化。
   - 对无直接命中的节点，确认显示同轮回退或未命中提示。

## 验收标准

1. 截图中的问题消失：`Prompt 分布` 不再只剩标题条。
2. 点击左侧节点时，`Prompt Ledger` 的节点作用域和诊断详情有可感知变化。
3. 默认视角能清楚看出 skill / workflow / memory / history / tool 的占比和优化优先级。
4. 详情区不再抢占主分布区高度。
5. 所有新增/修改的行为有测试覆盖，构建通过。

## 实施顺序

1. 提取或新增 `derivePromptNodeScope` 的测试，锁定节点联动规则。
2. 调整 `PromptLedgerPanel` 布局，让 `Prompt 分布` 成为主区域。
3. 把 `上下文诊断` 改成详情栏或抽屉，不再固定在底部。
4. 加强左侧节点点击后的选择重置和作用域反馈。
5. 更新静态 UI 测试。
6. 构建并启动 Electron 真窗口验收。

## 自检

1. 无未定占位符或未完成事项。
2. 目标与非目标边界清楚，本轮聚焦 Prompt Ledger 工作台，不扩散到整个 Trace Viewer。
3. 设计默认优先 skill / workflow 优化，同时保留节点调试能力。
4. 布局要求直接覆盖用户截图中的遮挡问题。
5. 测试策略覆盖节点联动和 UI 布局两个风险点。
