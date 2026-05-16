# src/ui/components/settings/ModelRoutingSettingsPage.tsx

> 模块：`ui-shell` · 语言：`tsx` · 行数：153

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `ModelRoutingSettingsPage@13`
- `state@15`
- `hasProfiles@16`
- `routedLabel@17`
- `routedNames@20`
- `patchRouting@21`
- `ModelSlotPatch@5`
- `ModelRoutingSettingsPageProps@8`
- `onChange@11`

## 依赖输入

- `../ModelSelect`
- `./model-routing-utils`
- `../../types`

## 对外暴露

- `ModelRoutingSettingsPage`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```tsx
import { ModelSelect } from "../ModelSelect";
import {
  applySharedModelRoutingPatch,
  buildSharedModelRoutingState,
  type ModelSlotPatch,
} from "./model-routing-utils";
import type { ApiConfigProfile } from "../../types";

type ModelRoutingSettingsPageProps = {
  profiles: ApiConfigProfile[];
  onChange: (updater: (current: ApiConfigProfile[]) => ApiConfigProfile[]) => void;
};

export function ModelRoutingSettingsPage({ profiles, onChange }: ModelRoutingSettingsPageProps) {
  const state = buildSharedModelRoutingState(profiles);
  const hasProfiles = profiles.length > 0;
  const routedLabel = state.enabledCount > 0
    ? `${state.enabledCount} 个启用配置共用`
    : "暂无启用配置，预览第一个配置";
  const routedNames = state.routedProfileNames.join(" / ");

  const patchRouting = (patch: ModelSlotPatch) => {
    onChange((current) => applySharedModelRoutingPatch(current, patch));
  };

  if (!hasProfiles) {
    return (
      <div className="rounded-[28px] border border-ink-900/10 bg-white/86 p-5 text-sm leading-6 text-muted shadow-[0_18px_44px_rgba(24,32,46,0.06)]">
        还没有可用配置，请先在下方新增一个 AI 接口配置。
      </div>
    );
  }

  return (
    <div className="rounded-[28px] border border-ink-900/10 bg-white/86 p-5 shadow-[0_18px_44px_rgba(24,32,46,0.06)]">
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <div className="truncate text-sm font-semibold text-ink-900">共享模型路由</div>
              <span className="rounded-full bg-accent/12 px-2 py-0.5 text-[11px] font-medium text-accent">
                {routedLabel}
              </span>
            </div>
            {routedNames && (
              <p className="mt-1 truncate text-xs text-muted">
                模型候选已合并：{routedNames}
              </p>
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className="rounded-xl border border-ink-900/10 bg-white px-3 py-2 text-xs text-ink-700 transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => patchRouting({ expertModel: state.mainModel })}
              disabled={!state.mainModel}
            >
              专家模型同步主模型
            </button>
            <button
              type="button"
              className="rounded-xl border border-ink-900/10 bg-white px-3 py-2 text-xs text-ink-700 transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => patchRouting({ smallModel: state.mainModel })}
              disabled={!state.mainModel}
            >
              小模型同步主模型
            </button>
            <button
              type="button"
              className="rounded-xl border border-ink-900/10 bg-white px-3 py-2 text-xs text-ink-700 transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => patchRouting({ wikiModel: state.smallModel || state.mainModel })}
              disabled={!state.smallModel && !state.mainModel}
            >
              Wiki 模型同步小模型
            </button>
            <button
              type="button"
              className="rounded-xl border border-ink-900/10 bg-white px-3 py-2 text-xs text-ink-700 transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => patchRouting({ imageModel: state.mainModel })}
              disabled={!state.mainModel}
            >
              图片模型同步主模型
            </button>
          </div>
        </div>
        <p className="text-sm leading-6 text-muted">
          启用配置共用这一套模型分工：主模型对话，专家兜底，小模型处理后台调用，Prompt 分析复盘，图片模型先读图，向量模型驱动知识库，Wiki 模型生成 .tech 文档。
        </p>
      </div>

      {state.availableModels.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-ink-900/8 bg-surface px-4 py-3 text-sm leading-6 text-muted">
          当前启用配置还没有可用模型，请先在下方配置列表里补齐模型列表。
        </div>
      ) : (
        <div className="mt-4 rounded-3xl border border-ink-900/8 bg-surface/80 p-4">
... (truncated)
```
