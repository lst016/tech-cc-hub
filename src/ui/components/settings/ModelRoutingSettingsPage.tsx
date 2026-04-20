import type { ApiConfigProfile } from "../../types";
import { getAvailableModels } from "./settings-utils";

type ModelRoutingSettingsPageProps = {
  profiles: ApiConfigProfile[];
  onChange: (updater: (current: ApiConfigProfile[]) => ApiConfigProfile[]) => void;
};

export function ModelRoutingSettingsPage({ profiles, onChange }: ModelRoutingSettingsPageProps) {
  return (
    <div className="grid gap-4">
      {profiles.map((profile) => {
        const availableModels = getAvailableModels(profile);
        const mainModel = profile.model || availableModels[0] || "";
        const expertModel = profile.expertModel || mainModel;

        return (
          <div key={profile.id} className="rounded-[28px] border border-ink-900/10 bg-white/86 p-5 shadow-[0_18px_44px_rgba(24,32,46,0.06)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="truncate text-sm font-semibold text-ink-900">{profile.name || "未命名配置"}</div>
                  {profile.enabled && (
                    <span className="rounded-full bg-accent/12 px-2 py-0.5 text-[11px] font-medium text-accent">
                      当前启用
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm leading-6 text-muted">
                  当前先把模型分工收敛到最关键的两层：主模型负责常规对话，专家模型负责复杂问题兜底和升级。
                </p>
              </div>
              <button
                type="button"
                className="rounded-xl border border-ink-900/10 bg-white px-3 py-2 text-xs text-ink-700 transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => onChange((current) => current.map((item) => (
                  item.id === profile.id
                    ? {
                      ...item,
                      expertModel: item.model,
                    }
                    : item
                )))}
                disabled={!mainModel}
              >
                专家模型同步主模型
              </button>
            </div>

            {availableModels.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-ink-900/8 bg-surface px-4 py-3 text-sm leading-6 text-muted">
                这个配置还没有可用模型，请先去“接口配置”里补齐模型列表。
              </div>
            ) : (
              <div className="mt-4 rounded-3xl border border-ink-900/8 bg-surface/80 p-4">
                <div className="text-xs font-semibold tracking-[0.16em] text-muted">MODEL SLOTS</div>
                <div className="mt-2 text-sm text-ink-800">主模型负责常规聊天，专家模型用于复杂问题、升级求助或后续高阶链路。</div>
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <label className="grid gap-1.5">
                    <span className="text-xs font-medium text-muted">默认主模型</span>
                    <select
                      className="rounded-xl border border-ink-900/10 bg-white px-4 py-2.5 text-sm text-ink-800 transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20"
                      value={mainModel}
                      onChange={(event) => onChange((current) => current.map((item) => (
                        item.id === profile.id
                          ? { ...item, model: event.target.value }
                          : item
                      )))}
                    >
                      {availableModels.map((model) => (
                        <option key={model} value={model}>{model}</option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-1.5">
                    <span className="text-xs font-medium text-muted">专家模型</span>
                    <select
                      className="rounded-xl border border-ink-900/10 bg-white px-4 py-2.5 text-sm text-ink-800 transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20"
                      value={expertModel}
                      onChange={(event) => onChange((current) => current.map((item) => (
                        item.id === profile.id
                          ? { ...item, expertModel: event.target.value }
                          : item
                      )))}
                    >
                      {availableModels.map((model) => (
                        <option key={model} value={model}>{model}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
