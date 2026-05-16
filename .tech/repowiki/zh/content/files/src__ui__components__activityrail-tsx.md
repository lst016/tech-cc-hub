# src/ui/components/ActivityRail.tsx

> 模块：`ui-shell` · 语言：`tsx` · 行数：1570

## 文件职责

活动时间轴组件，展示会话执行过程中的上下文使用、token消耗、计划进度等分析数据

## 关键符号

- `toneClasses@0 - 根据活动音色返回对应CSS类名`
- `getNodeKindLabel@0 - 获取节点类型的本地化标签`
- `renderTimelineWithStages@0 - 按阶段渲染时间轴项目`
- `summarizeAttachments@0 - 汇总附件信息`
- `buildMaterialStatusItems@0 - 构建素材状态列表`
- `ContextUsagePanel@0 - 上下文使用面板，显示token分布`
- `PlanProgressPanel@0 - 计划进度面板`
- `MetricsStrip@0 - 指标条组件`
- `AnalysisCard@0 - 分析卡片组件`

## 依赖输入

- `react`
- `../../shared/activity-rail-model`
- `../store/useAppStore`
- `../../shared/prompt-ledger`
- `../../shared/plan-progress`
- `../utils/context-usage-breakdown`
- `../utils/context-usage-cells`
- `./AionWorkspacePreviewPane`
- `./ActivityWorkspaceTabs`
- `./git`
- `../utils/activity-workspace-tabs`

## 对外暴露

- `ActivityRail`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```tsx
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  buildActivityRailModel,
  type ActivityAnalysisCard,
  type ActivityDetailSection,
  type ActivityExecutionMetrics,
  type ActivityRailTone,
  type ActivityTaskStep,
  type ActivityTimelineItem,
  type ActivityToolProvenance,
  type ContextDistributionBucket,
} from "../../shared/activity-rail-model";
import { useAppStore } from "../store/useAppStore";
import { estimatePromptLedgerTokens, type PromptLedgerSourceKind } from "../../shared/prompt-ledger";
import type { PlanStepStatus, SessionPlanSnapshot } from "../../shared/plan-progress";
import { buildContextUsageBreakdown, type ContextUsageBreakdownCategory } from "../utils/context-usage-breakdown";
import { buildSegmentedContextUsageCells, type ContextUsageCellSegment } from "../utils/context-usage-cells";
import { AionWorkspacePreviewPane } from "./AionWorkspacePreviewPane";
import { ActivityWorkspaceTabs } from "./ActivityWorkspaceTabs";
import { GitWorkbenchPanel } from "./git";
import type { SessionView } from "../store/useAppStore";
import type { ActivityRailTab, ActivityWorkspaceTab } from "../utils/activity-workspace-tabs";

const NODE_KIND_LABELS: Record<ActivityTimelineItem["nodeKind"], string> = {
  context: "上下文",
  plan: "AI 计划",
  assistant_output: "AI 输出",
  tool_input: "工具调用",
  retrieval: "检索",
  file_read: "读文件",
  file_write: "写文件",
  terminal: "终端",
  browser: "浏览器",
  memory: "Memory",
  mcp: "MCP",
  handoff: "子 Agent",
  evaluation: "校验",
  error: "错误",
  lifecycle: "生命周期",
  permission: "人工确认",
  hook: "Hook",
  omitted: "已省略",
  agent_progress: "Agent 进度",
};

const STAGE_ORDER = ["inspect", "implement", "verify", "deliver"] as const;
const STAGE_LABELS: Record<string, string> = {
  inspect: "检查与理解",
  implement: "实施与修改",
  verify: "验证与确认",
  deliver: "整理与输出",
  plan: "计划",
  other: "其他",
};

const PROMPT_SOURCE_KIND_LABELS: Record<string, string> = {
  system: "系统",
  project: "项目",
  skill: "Skill",
  workflow: "Workflow",
  current: "当前输入",
  attachment: "附件",
  memory: "Memory",
  history: "历史消息",
  tool: "工具",
  other: "其他",
};

const PROVENANCE_LABELS: Record<ActivityToolProvenance, string> = {
  local: "本地",
  mcp: "MCP",
  sub_agent: "子 Agent",
  a2a: "A2A",
  transfer_agent: "交接 Agent",
  unknown: "未归类",
};

function toneClasses(tone: ActivityRailTone) {
  switch (tone) {
    case "info":
      return "border-info/20 bg-info-light/50 text-info";
    case "success":
      return "border-success/20 bg-success-light/50 text-success";
    case "warning":
      return "border-accent/20 bg-accent-subtle text-accent";
    case "error":
      return "border-error/20 bg-error-light text-error";
    default:
      return "border-ink-900/10 bg-white/70 text-ink-700";
  }
}

function toneAccentClasses(tone: ActivityRailTone) {
  switch (tone) {
    case "info":
      return "bg-info";
    case "success":
      return "bg-success";
    case "warning":
      return "bg-accent";
    case "error":
      return "bg-error";
    default:
      return "bg-ink-500";
  }
}

function getNodeKindLabel(item: ActivityTimelineItem) {
  if (item.nodeKind === "terminal" && item.nodeSubtype === "validation") {
    return "终端校验";
  }
  return NODE_KIND_LABELS[item.nodeKind];
}

function TimelineItemRow({
  item,
  isSelected,
  onSelect,
}: {
  item: ActivityTimelineItem;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  const kindLabel = getNodeKindLabel(item);
  return (
    <button
      type="button"
      data-timeline-id={item.id}
      className={`w-full text-left rounded-2xl border p-3 transition ${
        isSelected
          ? "border-info/30 bg-info-light/40"
          : "border-black/5 bg-white/70 hover:border-black/10"
      }`}
      onClick={() => onSelect(item.id)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`inline-block h-2 w-2 rounded-full ${toneAccentClasses(item.tone)}`} />
            <span className="text-[13px] font-semibold text-ink-900 truncate">{item.title}</span>
          </div>
          <p classNa
... (truncated)
```
