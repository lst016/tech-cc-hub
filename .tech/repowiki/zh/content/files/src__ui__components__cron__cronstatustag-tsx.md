# src/ui/components/cron/CronStatusTag.tsx

> 模块：`ui-shell` · 语言：`tsx` · 行数：37

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `label@10`
- `colorClasses@20`
- `StatusTone@6`

## 依赖输入

- `react`
- `../../../types/cron.js`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```tsx
// Source: CV from AionUi CronStatusTag.tsx (50 lines)
// Adapted for tech-cc-hub: Tailwind CSS instead of arco-design Tag, hardcoded Chinese

import React from "react";
import type { CronJob } from "../../../types/cron.js";

type StatusTone = "paused" | "error" | "active";

const CronStatusTag: React.FC<{ job: CronJob }> = ({ job }) => {
  let label = "运行中";
  let tone: StatusTone = "active";

  if (!job.enabled) {
    tone = "paused";
    label = "已暂停";
  } else if (job.state.lastStatus === "error") {
    tone = "error";
    label = "异常";
  }

  const colorClasses = {
    active: "bg-green-50 text-green-700 border-green-200",
    paused: "bg-gray-50 text-gray-500 border-gray-200",
    error: "bg-red-50 text-red-600 border-red-200",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${colorClasses[tone]}`}
    >
      {label}
    </span>
  );
};

export default CronStatusTag;

```
