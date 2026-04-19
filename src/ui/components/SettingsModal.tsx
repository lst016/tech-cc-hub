import { useEffect, useState } from "react";
import { useAppStore } from "../store/useAppStore";

interface SettingsModalProps {
  onClose: () => void;
}

type ApiConfigProfile = {
  id: string;
  name: string;
  apiKey: string;
  baseURL: string;
  model: string;
  models?: string[];
  enabled: boolean;
  apiType?: "anthropic";
};

type ApiConfigSettings = {
  profiles: ApiConfigProfile[];
};

function createProfile(): ApiConfigProfile {
  return {
    id: crypto.randomUUID(),
    name: "新配置",
    apiKey: "",
    baseURL: "",
    model: "",
    models: [""],
    enabled: true,
    apiType: "anthropic",
  };
}

function normalizeProfile(profile: ApiConfigProfile): ApiConfigProfile {
  const models = Array.from(
    new Set((profile.models ?? []).map((item) => item.trim()).filter(Boolean))
  );
  const selectedModel = profile.model.trim() || models[0] || "";

  if (selectedModel && !models.includes(selectedModel)) {
    models.unshift(selectedModel);
  }

  return {
    ...profile,
    name: profile.name.trim() || "未命名配置",
    apiKey: profile.apiKey.trim(),
    baseURL: profile.baseURL.trim(),
    model: selectedModel,
    models,
    enabled: Boolean(profile.enabled),
    apiType: "anthropic",
  };
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const setApiConfigSettings = useAppStore((state) => state.setApiConfigSettings);
  const [profiles, setProfiles] = useState<ApiConfigProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setLoading(true);
    window.electron.getApiConfig()
      .then((settings: ApiConfigSettings) => {
        setApiConfigSettings(settings);
        if (settings.profiles.length > 0) {
          setProfiles(settings.profiles.map((profile) => ({
            ...profile,
            models: profile.models && profile.models.length > 0 ? profile.models : [profile.model],
          })));
        } else {
          setProfiles([createProfile()]);
        }
      })
      .catch((err) => {
        console.error("Failed to load API config:", err);
        setError("加载配置失败。");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [setApiConfigSettings]);

  const handleSave = async () => {
    const normalizedProfiles = profiles.map((profile) => normalizeProfile(profile));
    if (normalizedProfiles.length === 0) {
      setError("至少保留一个配置。");
      return;
    }

    const enabledIndex = normalizedProfiles.findIndex((profile) => profile.enabled);
    if (enabledIndex === -1) {
      setError("至少启用一个配置。");
      return;
    }

    for (const profile of normalizedProfiles) {
      if (!profile.name) {
        setError("每个配置都需要名称。");
        return;
      }
      if (!profile.apiKey) {
        setError(`配置「${profile.name}」必须填写 API Key。`);
        return;
      }
      if (!profile.baseURL) {
        setError(`配置「${profile.name}」必须填写接口地址。`);
        return;
      }
      if (!profile.model) {
        setError(`配置「${profile.name}」必须选择默认模型。`);
        return;
      }
      if ((profile.models ?? []).length === 0) {
        setError(`配置「${profile.name}」至少要保留一个模型。`);
        return;
      }

      try {
        new URL(profile.baseURL);
      } catch {
        setError(`配置「${profile.name}」的接口地址格式不正确。`);
        return;
      }
    }

    setError(null);
    setSaving(true);

    try {
      const result = await window.electron.saveApiConfig({
        profiles: normalizedProfiles.map((profile, index) => ({
          ...profile,
          enabled: index === enabledIndex,
        })),
      });

      if (result.success) {
        setApiConfigSettings({
          profiles: normalizedProfiles.map((profile, index) => ({
            ...profile,
            enabled: index === enabledIndex,
          })),
        });
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          onClose();
        }, 1000);
      } else {
        setError(result.error || "保存配置失败。");
      }
    } catch (err) {
      console.error("Failed to save API config:", err);
      setError("保存配置失败。");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/20 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-2xl border border-ink-900/5 bg-surface p-6 shadow-elevated">
        <div className="flex items-center justify-between">
          <div className="text-base font-semibold text-ink-800">接口配置</div>
          <button
            className="rounded-full p-1.5 text-muted hover:bg-surface-tertiary hover:text-ink-700 transition-colors"
            onClick={onClose}
            aria-label="关闭"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="mt-2 text-sm text-muted">支持 Anthropic 官方接口，也支持兼容 Anthropic 格式的第三方接口。你可以保存多套配置，并指定当前启用的那一套。</p>

        {loading ? (
          <div className="mt-5 flex items-center justify-center py-8">
            <svg aria-hidden="true" className="h-6 w-6 animate-spin text-accent" viewBox="0 0 100 101" fill="none">
              <path d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z" fill="currentColor" opacity="0.3" />
              <path d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z" fill="currentColor" />
            </svg>
          </div>
        ) : (
          <div className="mt-5 grid gap-4">
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium text-muted">配置列表</div>
              <button
                type="button"
                className="rounded-xl border border-ink-900/10 bg-surface px-3 py-2 text-sm text-ink-700 hover:bg-surface-tertiary transition-colors"
                onClick={() => setProfiles((current) => [
                  ...current.map((profile) => ({ ...profile, enabled: false })),
                  createProfile(),
                ])}
              >
                + 新增配置
              </button>
            </div>

            <div className="max-h-[56vh] overflow-y-auto pr-1">
              <div className="grid gap-4">
                {profiles.map((profile) => (
                  <div key={profile.id} className="rounded-2xl border border-ink-900/10 bg-surface-secondary p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-ink-800">{profile.name || "未命名配置"}</div>
                        <div className="mt-1 text-[11px] text-muted">{profile.enabled ? "当前启用" : "未启用"}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${profile.enabled ? "bg-accent text-white" : "border border-ink-900/10 bg-white text-ink-700 hover:bg-surface"}`}
                          onClick={() => setProfiles((current) => current.map((item) => ({
                            ...item,
                            enabled: item.id === profile.id,
                          })))}
                        >
                          {profile.enabled ? "启用中" : "启用"}
                        </button>
                        {profiles.length > 1 && (
                          <button
                            type="button"
                            className="rounded-full border border-ink-900/10 p-2 text-muted hover:bg-white hover:text-ink-700"
                            onClick={() => setProfiles((current) => {
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
                          className="rounded-xl border border-ink-900/10 bg-white px-4 py-2.5 text-sm text-ink-800 placeholder:text-muted-light focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20 transition-colors"
                          placeholder="例如：MiniMax 代理"
                          value={profile.name}
                          onChange={(e) => setProfiles((current) => current.map((item) => item.id === profile.id ? { ...item, name: e.target.value } : item))}
                        />
                      </label>

                      <label className="grid gap-1.5">
                        <span className="text-xs font-medium text-muted">接口地址</span>
                        <input
                          type="url"
                          className="rounded-xl border border-ink-900/10 bg-white px-4 py-2.5 text-sm text-ink-800 placeholder:text-muted-light focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20 transition-colors"
                          placeholder="https://..."
                          value={profile.baseURL}
                          onChange={(e) => setProfiles((current) => current.map((item) => item.id === profile.id ? { ...item, baseURL: e.target.value } : item))}
                        />
                      </label>

                      <label className="grid gap-1.5">
                        <span className="text-xs font-medium text-muted">API 密钥</span>
                        <input
                          type="text"
                          className="rounded-xl border border-ink-900/10 bg-white px-4 py-2.5 text-sm text-ink-800 placeholder:text-muted-light focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20 transition-colors"
                          placeholder="sk-..."
                          value={profile.apiKey}
                          onChange={(e) => setProfiles((current) => current.map((item) => item.id === profile.id ? { ...item, apiKey: e.target.value } : item))}
                        />
                      </label>

                      <div className="grid gap-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-muted">模型列表</span>
                          <button
                            type="button"
                            className="rounded-xl border border-ink-900/10 bg-white px-3 py-1.5 text-xs text-ink-700 hover:bg-surface"
                            onClick={() => setProfiles((current) => current.map((item) => item.id === profile.id ? { ...item, models: [...(item.models ?? []), ""] } : item))}
                          >
                            + 添加模型
                          </button>
                        </div>
                        <div className="grid gap-2">
                          {(profile.models ?? []).map((modelItem, modelIndex) => (
                            <div key={`${profile.id}-${modelIndex}`} className="flex items-center gap-2">
                              <input
                                type="text"
                                className="flex-1 rounded-xl border border-ink-900/10 bg-white px-4 py-2.5 text-sm text-ink-800 placeholder:text-muted-light focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20 transition-colors"
                                placeholder="claude-sonnet-4-5"
                                value={modelItem}
                                onChange={(e) => setProfiles((current) => current.map((item) => {
                                  if (item.id !== profile.id) return item;
                                  const models = [...(item.models ?? [])];
                                  models[modelIndex] = e.target.value;
                                  const nextModel = item.model === modelItem ? e.target.value : item.model;
                                  return { ...item, models, model: nextModel };
                                }))}
                              />
                              {(profile.models ?? []).length > 1 && (
                                <button
                                  type="button"
                                  className="rounded-full border border-ink-900/10 p-2 text-muted hover:bg-white hover:text-ink-700"
                                  onClick={() => setProfiles((current) => current.map((item) => {
                                    if (item.id !== profile.id) return item;
                                    const models = (item.models ?? []).filter((_, index) => index !== modelIndex);
                                    const nextModel = item.model === modelItem ? (models[0] ?? "") : item.model;
                                    return { ...item, models, model: nextModel };
                                  }))}
                                  aria-label={`删除模型 ${modelItem || modelIndex + 1}`}
                                >
                                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                                    <path d="M6 6l12 12M18 6 6 18" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      <label className="grid gap-1.5">
                        <span className="text-xs font-medium text-muted">默认模型</span>
                        <select
                          className="rounded-xl border border-ink-900/10 bg-white px-4 py-2.5 text-sm text-ink-800 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20 transition-colors"
                          value={profile.model}
                          onChange={(e) => setProfiles((current) => current.map((item) => item.id === profile.id ? { ...item, model: e.target.value } : item))}
                        >
                          {(profile.models ?? []).filter((item) => item.trim()).map((item) => (
                            <option key={item} value={item}>{item}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-error/20 bg-error-light px-4 py-2.5 text-sm text-error">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-xl border border-success/20 bg-success-light px-4 py-2.5 text-sm text-success">
                配置已保存。
              </div>
            )}

            <div className="flex gap-3">
              <button
                className="flex-1 rounded-xl border border-ink-900/10 bg-surface px-4 py-2.5 text-sm font-medium text-ink-700 hover:bg-surface-tertiary transition-colors"
                onClick={onClose}
                disabled={saving}
              >
                取消
              </button>
              <button
                className="flex-1 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white shadow-soft hover:bg-accent-hover transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                onClick={handleSave}
                disabled={saving || profiles.length === 0}
              >
                {saving ? (
                  <svg aria-hidden="true" className="mx-auto h-5 w-5 animate-spin" viewBox="0 0 100 101" fill="none">
                    <path d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z" fill="currentColor" opacity="0.3" />
                    <path d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z" fill="white" />
                  </svg>
                ) : "保存"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
