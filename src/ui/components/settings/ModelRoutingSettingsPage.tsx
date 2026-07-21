import { ModelSelect } from "../models/ModelSelect";
import { ChartNoAxesColumnIncreasing, ImageIcon, Route } from "lucide-react";
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
  const roleModelOptions = state.roleModelOptions.map((option) => ({
    value: option.value,
    label: option.label,
    description: option.routeLabel,
    badge: option.providerLabel,
    title: `${option.value} → ${option.routeLabel}`,
  }));
  const analysisModelOptions = state.analysisModelOptions.map((option) => ({
    value: option.value,
    label: option.label,
    description: option.routeLabel,
    badge: option.providerLabel,
    title: `${option.value} → ${option.routeLabel}`,
  }));
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
      <div className="rounded-[18px] border border-ink-900/10 bg-white p-6 text-sm leading-6 text-muted shadow-[0_1px_2px_rgba(24,32,46,0.04)]">
        还没有可用配置，请先到“接口连接”新增一个 AI 接口。
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="relative overflow-visible rounded-[18px] border border-ink-900/10 bg-white px-6 py-5 shadow-[0_1px_2px_rgba(24,32,46,0.04)]">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold text-ink-900">共享模型路由</h3>
          <span className="rounded-full bg-accent/10 px-2.5 py-1 text-[11px] font-medium text-accent">
            {routedLabel}
          </span>
        </div>
        <p className="mt-1.5 text-sm leading-6 text-muted">
          按任务分配模型，系统会根据模型归属自动选择对应网关。
        </p>
        {routedNames && (
          <p className="mt-2 truncate text-xs text-muted/80" title={routedNames}>
            模型来源：{routedNames}
          </p>
        )}
      </section>

      {state.availableModels.length === 0 ? (
        <div className="rounded-[18px] border border-ink-900/8 bg-white px-5 py-4 text-sm leading-6 text-muted shadow-[0_1px_2px_rgba(24,32,46,0.04)]">
          当前启用配置还没有已纳管模型，请先到“模型目录”把模型加入可用池。
        </div>
      ) : (
        <>
          <section className="relative grid gap-6 overflow-visible rounded-[18px] border border-accent/25 bg-accent/[0.025] p-6 shadow-[0_1px_2px_rgba(24,32,46,0.03)] lg:grid-cols-[320px_minmax(0,1fr)] lg:items-center">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-accent/15 bg-white text-accent shadow-[0_1px_2px_rgba(24,32,46,0.04)]">
                <Route className="h-5 w-5" />
              </span>
              <div>
                <div className="text-base font-semibold text-ink-900">主路由</div>
                <div className="mt-1 text-xs leading-5 text-muted">对话与任务执行的默认入口</div>
              </div>
            </div>
            <ModelSelect
              label="默认主模型"
              value={state.mainModel}
              models={state.availableModels}
              onChange={(model) => patchRouting({ model })}
            />
          </section>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,1fr)]">
            <section className="relative overflow-visible rounded-[18px] border border-ink-900/10 bg-white p-6 shadow-[0_1px_2px_rgba(24,32,46,0.04)]">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-sky-200/70 bg-sky-50 text-sky-600">
                  <ChartNoAxesColumnIncreasing className="h-5 w-5" />
                </span>
                <div>
                  <div className="text-base font-semibold text-ink-900">执行分工</div>
                  <p className="mt-1 text-xs leading-5 text-muted">
                    细分推理、后台任务与 Prompt 分析。
                  </p>
                  <p className="mt-1 text-[11px] leading-5 text-sky-700">
                    当前专家/后台网关：{state.roleProfileName}。Prompt 分析按同名模型权重独立选择网关。
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <ModelSelect
                  label="专家模型"
                  value={state.expertModel}
                  models={state.roleModels}
                  modelOptions={roleModelOptions}
                  onChange={(expertModel) => patchRouting({ expertModel })}
                />
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="relative min-w-0">
                  <ModelSelect
                    label="小模型 / 后台模型"
                    value={state.smallModel}
                    models={state.roleModels}
                    modelOptions={roleModelOptions}
                    onChange={(smallModel) => patchRouting({ smallModel })}
                  />
                  <button
                    type="button"
                    className="absolute right-0 top-[-2px] rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-600 transition-colors hover:border-sky-300 hover:bg-sky-100 disabled:cursor-not-allowed disabled:border-ink-900/8 disabled:bg-surface disabled:text-muted/50"
                    onClick={() => patchRouting({ smallModel: state.mainModel })}
                    disabled={!state.mainModel}
                  >
                    跟随主模型
                  </button>
                </div>
                <div className="relative min-w-0">
                  <ModelSelect
                    label="Prompt 分析模型"
                    value={state.analysisModel}
                    models={state.analysisModels}
                    modelOptions={analysisModelOptions}
                    onChange={(analysisModel) => patchRouting({ analysisModel })}
                  />
                  <button
                    type="button"
                    className="absolute right-0 top-[-2px] rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-600 transition-colors hover:border-sky-300 hover:bg-sky-100 disabled:cursor-not-allowed disabled:border-ink-900/8 disabled:bg-surface disabled:text-muted/50"
                    onClick={() => patchRouting({ analysisModel: state.mainModel })}
                    disabled={!state.mainModel}
                  >
                    跟随主模型
                  </button>
                </div>
              </div>
            </section>

            <section className="relative overflow-visible rounded-[18px] border border-ink-900/10 bg-white p-6 shadow-[0_1px_2px_rgba(24,32,46,0.04)]">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-violet-500/10 bg-violet-500/8 text-violet-700">
                  <ImageIcon className="h-5 w-5" />
                </span>
                <div>
                  <div className="text-base font-semibold text-ink-900">多模态能力</div>
                  <div className="mt-1 text-xs leading-5 text-muted">只显示能力匹配的模型</div>
                </div>
              </div>

              <div className="mt-6">
                <div className="relative min-w-0">
                  <ModelSelect
                    label="图片预处理模型"
                    value={state.imageModel}
                    models={state.imageUnderstandingModels}
                    emptyOption={{ value: "", label: "不启用图片预处理" }}
                    onChange={(imageModel) => patchRouting({ imageModel: imageModel || undefined })}
                  />
                  <button
                    type="button"
                    title={state.imageUnderstandingModels.includes(state.mainModel) ? undefined : "当前主模型不支持图片理解"}
                    className="absolute right-0 top-[-2px] rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700 transition-colors hover:border-violet-300 hover:bg-violet-100 disabled:cursor-not-allowed disabled:border-ink-900/8 disabled:bg-surface disabled:text-muted/50"
                    onClick={() => patchRouting({ imageModel: state.mainModel })}
                    disabled={!state.imageUnderstandingModels.includes(state.mainModel)}
                  >
                    跟随主模型
                  </button>
                </div>

                <div className="my-5 h-px bg-ink-900/8" />

                <ModelSelect
                  label="生图模型"
                  value={state.imageGenerationModel}
                  models={state.imageGenerationModels}
                  emptyOption={{ value: "", label: "不启用生图" }}
                  onChange={(imageGenerationModel) => patchRouting({ imageGenerationModel: imageGenerationModel || undefined })}
                />
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
