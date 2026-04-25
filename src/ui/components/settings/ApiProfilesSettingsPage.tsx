import type { ApiConfigProfile } from "../../types";
import { createModel, createProfile, getAvailableModels } from "./settings-utils";

type ApiProfilesSettingsPageProps = {
  profiles: ApiConfigProfile[];
  onChange: (updater: (current: ApiConfigProfile[]) => ApiConfigProfile[]) => void;
};

export function ApiProfilesSettingsPage({ profiles, onChange }: ApiProfilesSettingsPageProps) {
  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-muted">配置列表</div>
        <button
          type="button"
          className="rounded-xl border border-ink-900/10 bg-white px-3 py-2 text-sm text-ink-700 transition-colors hover:bg-surface"
          onClick={() => onChange((current) => [
            ...current.map((profile) => ({ ...profile, enabled: false })),
            createProfile(),
          ])}
        >
          + 新增配置
        </button>
      </div>

      <div className="grid gap-4">
        {profiles.map((profile) => (
          <div key={profile.id} className="rounded-[28px] border border-ink-900/10 bg-white/86 p-5 shadow-[0_18px_44px_rgba(24,32,46,0.06)]">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-ink-900">{profile.name || "未命名配置"}</div>
                <div className="mt-1 text-[11px] text-muted">{profile.enabled ? "当前启用" : "未启用"}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${profile.enabled ? "bg-accent text-white" : "border border-ink-900/10 bg-white text-ink-700 hover:bg-surface"}`}
                  onClick={() => onChange((current) => current.map((item) => ({
                    ...item,
                    enabled: item.id === profile.id,
                  })))}
                >
                  {profile.enabled ? "启用中" : "启用"}
                </button>
                {profiles.length > 1 && (
                  <button
                    type="button"
                    className="rounded-full border border-ink-900/10 p-2 text-muted hover:bg-surface hover:text-ink-700"
                    onClick={() => onChange((current) => {
                      const next = current.filter((item) => item.id !== profile.id);
                      if (next.every((item) => !item.enabled) && next[0]) {
                        next[0] = { ...next[0], enabled: true };
                      }
                      return next;
                    })}
                    aria-label={`删除配置 ${profile.name}`}
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M6 6l12 12M18 6 6 18" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-muted">配置名称</span>
                <input
                  type="text"
                  className="rounded-xl border border-ink-900/10 bg-surface px-4 py-2.5 text-sm text-ink-800 placeholder:text-muted-light transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20"
                  placeholder="例如：兼容网关"
                  value={profile.name}
                  onChange={(event) => onChange((current) => current.map((item) => (
                    item.id === profile.id
                      ? { ...item, name: event.target.value }
                      : item
                  )))}
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-muted">接口地址</span>
                <input
                  type="url"
                  className="rounded-xl border border-ink-900/10 bg-surface px-4 py-2.5 text-sm text-ink-800 placeholder:text-muted-light transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20"
                  placeholder="https://..."
                  value={profile.baseURL}
                  onChange={(event) => onChange((current) => current.map((item) => (
                    item.id === profile.id
                      ? { ...item, baseURL: event.target.value }
                      : item
                  )))}
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-muted">API 密钥</span>
                <input
                  type="text"
                  className="rounded-xl border border-ink-900/10 bg-surface px-4 py-2.5 text-sm text-ink-800 placeholder:text-muted-light transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20"
                  placeholder="sk-..."
                  value={profile.apiKey}
                  onChange={(event) => onChange((current) => current.map((item) => (
                    item.id === profile.id
                      ? { ...item, apiKey: event.target.value }
                      : item
                  )))}
                />
              </label>

              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted">模型列表</span>
                  <button
                    type="button"
                    className="rounded-xl border border-ink-900/10 bg-white px-3 py-1.5 text-xs text-ink-700 hover:bg-surface"
                    onClick={() => onChange((current) => current.map((item) => (
                      item.id === profile.id
                        ? { ...item, models: [...(item.models ?? []), createModel()] }
                        : item
                    )))}
                  >
                    + 添加模型
                  </button>
                </div>
                <div className="grid gap-3">
                  {(profile.models ?? []).map((modelItem, modelIndex) => (
                    <div key={`${profile.id}-${modelIndex}`} className="rounded-2xl border border-ink-900/10 bg-surface p-3">
                      <div className="flex items-start gap-2">
                        <div className="grid flex-1 gap-3 lg:grid-cols-3">
                          <label className="grid gap-1.5">
                            <span className="text-[11px] font-medium text-muted">模型名</span>
                            <input
                              type="text"
                              className="rounded-xl border border-ink-900/10 bg-white px-3 py-2 text-sm text-ink-800 placeholder:text-muted-light transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20"
                              placeholder="claude-sonnet-4-5"
                              value={modelItem.name}
                              onChange={(event) => onChange((current) => current.map((item) => {
                                if (item.id !== profile.id) return item;
                                const models = [...(item.models ?? [])];
                                const previousName = models[modelIndex]?.name ?? "";
                                models[modelIndex] = { ...models[modelIndex], name: event.target.value };
                                return {
                                  ...item,
                                  models,
                                  model: item.model === previousName ? event.target.value : item.model,
                                  expertModel: item.expertModel === previousName ? event.target.value : item.expertModel,
                                  imageModel: item.imageModel === previousName ? event.target.value : item.imageModel,
                                  analysisModel: item.analysisModel === previousName ? event.target.value : item.analysisModel,
                                };
                              }))}
                            />
                          </label>

                          <label className="grid gap-1.5">
                            <span className="text-[11px] font-medium text-muted">上下文窗口</span>
                            <input
                              type="number"
                              min={1}
                              step={1}
                              className="rounded-xl border border-ink-900/10 bg-white px-3 py-2 text-sm text-ink-800 placeholder:text-muted-light transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20"
                              placeholder="例如 200000"
                              value={modelItem.contextWindow ?? ""}
                              onChange={(event) => onChange((current) => current.map((item) => {
                                if (item.id !== profile.id) return item;
                                const models = [...(item.models ?? [])];
                                models[modelIndex] = {
                                  ...models[modelIndex],
                                  contextWindow: event.target.value ? Number(event.target.value) : undefined,
                                };
                                return { ...item, models };
                              }))}
                            />
                          </label>

                          <label className="grid gap-1.5">
                            <span className="text-[11px] font-medium text-muted">压缩阈值 (%)</span>
                            <input
                              type="number"
                              min={1}
                              max={100}
                              step={1}
                              className="rounded-xl border border-ink-900/10 bg-white px-3 py-2 text-sm text-ink-800 placeholder:text-muted-light transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20"
                              placeholder="70"
                              value={modelItem.compressionThresholdPercent ?? ""}
                              onChange={(event) => onChange((current) => current.map((item) => {
                                if (item.id !== profile.id) return item;
                                const models = [...(item.models ?? [])];
                                models[modelIndex] = {
                                  ...models[modelIndex],
                                  compressionThresholdPercent: event.target.value ? Number(event.target.value) : undefined,
                                };
                                return { ...item, models };
                              }))}
                            />
                          </label>
                        </div>

                        {(profile.models ?? []).length > 1 && (
                          <button
                            type="button"
                            className="rounded-full border border-ink-900/10 p-2 text-muted hover:bg-white hover:text-ink-700"
                            onClick={() => onChange((current) => current.map((item) => {
                              if (item.id !== profile.id) return item;
                              const models = (item.models ?? []).filter((_, index) => index !== modelIndex);
                              const deletedName = modelItem.name;
                              const fallbackModel = models[0]?.name ?? "";
                              return {
                                ...item,
                                models,
                                model: item.model === deletedName ? fallbackModel : item.model,
                                expertModel: item.expertModel === deletedName ? fallbackModel : item.expertModel,
                                imageModel: item.imageModel === deletedName ? undefined : item.imageModel,
                                analysisModel: item.analysisModel === deletedName ? fallbackModel : item.analysisModel,
                              };
                            }))}
                            aria-label={`删除模型 ${modelItem.name || modelIndex + 1}`}
                          >
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                              <path d="M6 6l12 12M18 6 6 18" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-muted">默认主模型</span>
                <select
                  className="rounded-xl border border-ink-900/10 bg-surface px-4 py-2.5 text-sm text-ink-800 transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20"
                  value={profile.model}
                  onChange={(event) => onChange((current) => current.map((item) => (
                    item.id === profile.id
                      ? { ...item, model: event.target.value }
                      : item
                  )))}
                >
                  {getAvailableModels(profile).map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-muted">图片预处理模型</span>
                <select
                  className="rounded-xl border border-ink-900/10 bg-surface px-4 py-2.5 text-sm text-ink-800 transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20"
                  value={profile.imageModel ?? ""}
                  onChange={(event) => onChange((current) => current.map((item) => (
                    item.id === profile.id
                      ? { ...item, imageModel: event.target.value || undefined }
                      : item
                  )))}
                >
                  <option value="">不预处理图片</option>
                  {getAvailableModels(profile).map((item) => (
                    <option key={`image-${item}`} value={item}>{item}</option>
                  ))}
                </select>
                <span className="text-[11px] text-muted">
                  有图片附件时，先走图片模型提取 OCR 和界面摘要，再把文本交给主 Agent。
                </span>
              </label>

              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-muted">Prompt 分析模型</span>
                <select
                  className="rounded-xl border border-ink-900/10 bg-surface px-4 py-2.5 text-sm text-ink-800 transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20"
                  value={profile.analysisModel ?? profile.model}
                  onChange={(event) => onChange((current) => current.map((item) => (
                    item.id === profile.id
                      ? { ...item, analysisModel: event.target.value }
                      : item
                  )))}
                >
                  {getAvailableModels(profile).map((item) => (
                    <option key={`analysis-${item}`} value={item}>{item}</option>
                  ))}
                </select>
                <span className="text-[11px] text-muted">
                  用于 Prompt 分布诊断、改写建议和上下文压缩建议，避免占用主执行模型的路由。
                </span>
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
