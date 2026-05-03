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
