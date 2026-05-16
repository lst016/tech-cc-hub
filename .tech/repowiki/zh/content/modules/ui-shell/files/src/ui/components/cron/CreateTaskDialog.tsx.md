# src/ui/components/cron/CreateTaskDialog.tsx

> 模块：`ui-shell` · 语言：`tsx` · 行数：450

## 文件职责

创建和编辑定时任务的对话框组件

## 运行信号

- `electron.invoke: cron:update-job`
- `electron.invoke: cron:add-job`

## 关键符号

- `parseCronExpr@0 - 解析cron表达式，识别频率类型和时间设置`
- `WEEKDAYS@0 - 星期几的中文标签数组`
- `CreateTaskDialog@0 - 创建任务对话框，支持手动/每小时/每天/工作日/每周/自定义频率`

## 依赖输入

- `react`
- `../../../types/cron.js`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```tsx
// Source: CV from AionUi CreateTaskDialog.tsx (777 lines)
// Adapted for tech-cc-hub: simplified — removed agent/model selection, arco-design → Tailwind,
// hardcoded Chinese, removed i18n, WorkspaceFolderSelect, AcpConfigSelector, GuidModelSelector

import React, { useState, useMemo, useEffect, useCallback } from "react";
import type { CronJob, CronSchedule, CreateCronJobParams } from "../../../types/cron.js";

interface CreateTaskDialogProps {
  visible: boolean;
  onClose: () => void;
  editJob?: CronJob;
  conversationId?: string;
  conversationTitle?: string;
  workspaces?: Array<{ conversationId: string; conversationTitle: string; workspaceName: string }>;
  onSelectWorkspace?: (workspace: { conversationId: string; conversationTitle: string }) => void;
}

type FrequencyType = "manual" | "hourly" | "daily" | "weekdays" | "weekly" | "custom";
type ExecutionMode = "new_conversation" | "existing";

const WEEKDAYS = [
  { value: "MON", label: "周一" },
  { value: "TUE", label: "周二" },
  { value: "WED", label: "周三" },
  { value: "THU", label: "周四" },
  { value: "FRI", label: "周五" },
  { value: "SAT", label: "周六" },
  { value: "SUN", label: "周日" },
];

function parseCronExpr(expr: string): { frequency: FrequencyType; time: string; weekday: string } {
  if (!expr) return { frequency: "manual", time: "09:00", weekday: "MON" };

  const parts = expr.trim().split(/\s+/);
  if (parts.length < 5) return { frequency: "daily", time: "09:00", weekday: "MON" };

  const [min, hour, day, month, dow] = parts;

  if (hour === "*" && min === "0" && day === "*" && month === "*" && dow === "*") {
    return { frequency: "hourly", time: "09:00", weekday: "MON" };
  }

  if (dow === "MON-FRI" && day === "*" && month === "*") {
    const hh = String(hour).padStart(2, "0");
    const mm = String(min).padStart(2, "0");
    return { frequency: "weekdays", time: `${hh}:${mm}`, weekday: "MON" };
  }

  if (dow !== "*" && day === "*" && month === "*") {
    const dayUpper = dow.toUpperCase();
    const matched = WEEKDAYS.find((d) => d.value === dayUpper);
    if (matched) {
      const hh = String(hour).padStart(2, "0");
      const mm = String(min).padStart(2, "0");
      return { frequency: "weekly", time: `${hh}:${mm}`, weekday: dayUpper };
    }
    return { frequency: "daily", time: "09:00", weekday: "MON" };
  }

  if (day === "*" && month === "*" && dow === "*") {
    const hourNum = Number(hour);
    const minNum = Number(min);
    if (!isNaN(hourNum) && !isNaN(minNum) && hourNum >= 0 && hourNum <= 23 && minNum >= 0 && minNum <= 59) {
      const hh = String(hourNum).padStart(2, "0");
      const mm = String(minNum).padStart(2, "0");
      return { frequency: "daily", time: `${hh}:${mm}`, weekday: "MON" };
    }
  }

  return { frequency: "custom", time: "09:00", weekday: "MON" };
}

const CreateTaskDialog: React.FC<CreateTaskDialogProps> = ({
  visible,
  onClose,
  editJob,
  conversationId,
  conversationTitle,
  workspaces,
  onSelectWorkspace,
}) => {
  const isEditMode = !!editJob;

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [prompt, setPrompt] = useState("");
  const [frequency, setFrequency] = useState<FrequencyType>("daily");
  const [time, setTime] = useState("09:00");
  const [weekday, setWeekday] = useState("MON");
  const [customCronExpr, setCustomCronExpr] = useState("");
  const [executionMode, setExecutionMode] = useState<ExecutionMode>("existing");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [selectedConvId, setSelectedConvId] = useState(conversationId ?? "");
  const [selectedConvTitle, setSelectedConvTitle] = useState(conversationTitle ?? "");

  // Populate form for edit mode
  useEffect(() => {
    if (!visible) return;
    if (editJob) {
      const cronExpr = editJob.schedule.kind === "cron" ? editJob.schedule.expr : "";
      const parsed = parseCronExpr(cronExpr);
      setName(editJob.name);
      setDescription(editJob.description ?? "");
      setPrompt(editJob.target.payload.text);
      setFrequency(pars
... (truncated)
```
