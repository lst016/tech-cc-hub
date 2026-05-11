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
              onClick={() => patchRouting({ imageModel: state.mainModel })}
              disabled={!state.mainModel}
            >
              图片模型同步主模型
            </button>
          </div>
        </div>
        <p className="text-sm leading-6 text-muted">
          启用配置共用这一套模型分工：主模型对话，专家兜底，小模型处理后台调用，Prompt 分析复盘，图片模型先读图。
        </p>
      </div>

      {state.availableModels.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-ink-900/8 bg-surface px-4 py-3 text-sm leading-6 text-muted">
          当前启用配置还没有可用模型，请先在下方配置列表里补齐模型列表。
        </div>
      ) : (
        <div className="mt-4 rounded-3xl border border-ink-900/8 bg-surface/80 p-4">
          <div className="text-xs font-semibold tracking-[0.16em] text-muted">MODEL SLOTS</div>
          <div className="mt-2 text-sm text-ink-800">
            这里的候选模型来自所有启用配置的合并列表；调整后会同步写回启用配置，避免多张配置卡各自维护一套路由。
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
            <ModelSelect
              label="默认主模型"
              value={state.mainModel}
              models={state.availableModels}
              onChange={(model) => patchRouting({ model })}
            />
            <ModelSelect
              label="专家模型"
              value={state.expertModel}
              models={state.availableModels}
              onChange={(expertModel) => patchRouting({ expertModel })}
            />
            <ModelSelect
              label="小模型 / 后台模型"
              value={state.smallModel}
              models={state.availableModels}
              onChange={(smallModel) => patchRouting({ smallModel })}
            />
            <ModelSelect
              label="Prompt 分析模型"
              value={state.analysisModel}
              models={state.availableModels}
              onChange={(analysisModel) => patchRouting({ analysisModel })}
            />
            <ModelSelect
              label="图片预处理模型"
              value={state.imageModel}
              models={state.availableModels}
              emptyOption={{ value: "", label: "不启用图片预处理" }}
              onChange={(imageModel) => patchRouting({ imageModel: imageModel || undefined })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
