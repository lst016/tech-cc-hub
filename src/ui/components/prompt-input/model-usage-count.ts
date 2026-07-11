/**
 * 模型使用次数计数 + 持久化。
 *
 * 仅作为聊天区模型选择框的排序依据：常用模型排在前面。
 * 计数时机为"发送消息"（见 PromptInput.tsx），不在选中模型时计数，
 * 避免反复切换虚高。存储在 localStorage，结构为 Record<modelValue, number>。
 */

const STORAGE_KEY = "tech-cc-hub:model-usage-count";

/** 计数变更后派发的 window 自定义事件名，供 ComposerModelMenu 订阅刷新排序。 */
export const MODEL_USAGE_CHANGED_EVENT = "tech-cc-hub:model-usage-changed";

type ModelUsageCounts = Record<string, number>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** 读取全部模型使用次数；任何异常都安全降级为空记录。 */
export function getModelUsageCounts(): ModelUsageCounts {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return {};
    const result: ModelUsageCounts = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "number" && Number.isFinite(value) && value > 0) {
        result[key] = Math.floor(value);
      }
    }
    return result;
  } catch {
    return {};
  }
}

/** 读取单个模型的使用次数；空模型名返回 0。 */
export function getModelUsageCount(model: string): number {
  if (!model) return 0;
  return getModelUsageCounts()[model] ?? 0;
}

/**
 * 给指定模型的使用次数 +1 并持久化，随后派发变更事件通知订阅者刷新。
 * 空模型名不做任何操作；写入失败时静默忽略（不影响发送流程）。
 */
export function incrementModelUsage(model: string): void {
  const trimmed = model?.trim();
  if (!trimmed) return;

  const counts = getModelUsageCounts();
  counts[trimmed] = (counts[trimmed] ?? 0) + 1;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(counts));
  } catch {
    // 配额超限或序列化失败时不阻断主流程。
  }

  try {
    window.dispatchEvent(new CustomEvent(MODEL_USAGE_CHANGED_EVENT));
  } catch {
    // 派发失败不影响持久化结果。
  }
}
