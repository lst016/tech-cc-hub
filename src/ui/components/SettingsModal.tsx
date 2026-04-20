import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "../store/useAppStore";
import type { ApiConfigProfile } from "../types";
import { ApiProfilesSettingsPage } from "./settings/ApiProfilesSettingsPage";
import { GlobalJsonSettingsPage } from "./settings/GlobalJsonSettingsPage";
import { ModelRoutingSettingsPage } from "./settings/ModelRoutingSettingsPage";
import { SettingsSheet, type SettingsPageDefinition } from "./settings/SettingsSheet";
import {
  buildRoutingSummary,
  createProfile,
  getEnabledProfile,
  normalizeProfile,
  validateProfiles,
} from "./settings/settings-utils";

interface SettingsModalProps {
  onClose: () => void;
}

type GlobalRuntimeConfig = Record<string, unknown>;

type SettingsPageId = "profiles" | "routing" | "global-json";

const SETTINGS_PAGES: SettingsPageDefinition[] = [
  {
    id: "profiles",
    label: "接口配置",
    eyebrow: "API",
    title: "接口配置",
    description: "维护 API 网关、密钥和模型池。默认主模型会作为当前聊天的运行入口。",
    summary: "网关、密钥、模型池",
  },
  {
    id: "routing",
    label: "模型分工",
    eyebrow: "ROLES",
    title: "模型分工",
    description: "定义默认主模型、工具模型、图像识别模型和专家模型。这一页后续也可以继续挂路由和策略配置。",
    summary: "主模型与角色路由",
  },
  {
    id: "global-json",
    label: "全局配置",
    eyebrow: "RUNTIME",
    title: "全局配置",
    description: "维护通用参数 JSON（如 skills、hooks、执行参数等），模型相关设置请继续在“模型分工”页维护。",
    summary: "JSON 通用配置",
  },
];

function validateGlobalConfigText(rawText: string): string | null {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return "配置必须是合法 JSON 对象。";
    }
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "JSON 格式不合法。";
  }
}

function parseGlobalConfig(rawText: string): GlobalRuntimeConfig | null {
  const parseError = validateGlobalConfigText(rawText);
  if (parseError) {
    return null;
  }
  if (!rawText.trim()) {
    return {};
  }
  return JSON.parse(rawText) as GlobalRuntimeConfig;
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const setApiConfigSettings = useAppStore((state) => state.setApiConfigSettings);
  const [profiles, setProfiles] = useState<ApiConfigProfile[]>([]);
  const [globalConfigText, setGlobalConfigText] = useState("{}");
  const [activePageId, setActivePageId] = useState<SettingsPageId>("profiles");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ tone: "error" | "success"; message: string } | null>(null);
  const [globalConfigParseError, setGlobalConfigParseError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      window.electron.getApiConfig(),
      window.electron.getGlobalConfig(),
    ])
      .then(([apiSettings, globalSettings]) => {
        const normalizedProfiles = apiSettings.profiles.length > 0
          ? apiSettings.profiles.map((profile) => normalizeProfile(profile))
          : [createProfile()];
        const hasConfiguredProfile = normalizedProfiles.some((profile) => (
          profile.apiKey.trim().length > 0 &&
          profile.baseURL.trim().length > 0 &&
          profile.model.trim().length > 0
        ));

        setApiConfigSettings({ profiles: normalizedProfiles });
        setProfiles(normalizedProfiles);
        setActivePageId(hasConfiguredProfile ? "routing" : "profiles");
        setGlobalConfigText(JSON.stringify(globalSettings, null, 2));
        setGlobalConfigParseError(validateGlobalConfigText(JSON.stringify(globalSettings, null, 2)));
      })
      .catch((err) => {
        console.error("Failed to load API config:", err);
        setStatus({ tone: "error", message: "加载配置失败。" });
      })
      .finally(() => {
        setLoading(false);
      });
  }, [setApiConfigSettings]);

  const enabledProfile = useMemo(() => getEnabledProfile(profiles), [profiles]);
  const pages = useMemo(() => SETTINGS_PAGES.map((page) => {
    if (page.id === "profiles") {
      return {
        ...page,
        summary: `共 ${profiles.length} 个配置`,
      };
    }
    if (page.id === "routing") {
      return {
        ...page,
        summary: buildRoutingSummary(enabledProfile),
      };
    }
    return page;
  }), [enabledProfile, profiles.length]);

  const updateProfiles = (updater: (current: ApiConfigProfile[]) => ApiConfigProfile[]) => {
    setStatus(null);
    setProfiles((current) => updater(current));
  };

  const handleGlobalConfigChange = (next: string) => {
    setStatus(null);
    setGlobalConfigText(next);
    setGlobalConfigParseError(validateGlobalConfigText(next));
  };

  const handleFormatGlobalConfig = () => {
    setStatus(null);
    const parsed = parseGlobalConfig(globalConfigText);
    if (!parsed && globalConfigText.trim()) {
      setGlobalConfigParseError(validateGlobalConfigText(globalConfigText));
      return;
    }
    setGlobalConfigText(JSON.stringify(parsed ?? {}, null, 2));
    setGlobalConfigParseError(null);
  };

  const handleSave = async () => {
    const normalizedProfiles = profiles.map((profile) => normalizeProfile(profile));
    const normalizedGlobalConfig = parseGlobalConfig(globalConfigText);
    const globalError = validateGlobalConfigText(globalConfigText);

    const validationError = validateProfiles(normalizedProfiles);
    if (validationError) {
      setStatus({ tone: "error", message: validationError });
      return;
    }

    if (globalError) {
      setGlobalConfigParseError(globalError);
      setStatus({ tone: "error", message: "全局配置 JSON 不合法，先修正后再保存。" });
      return;
    }

    if (normalizedGlobalConfig === null) {
      setStatus({ tone: "error", message: "全局配置保存失败，配置被解析为空。" });
      return;
    }

    const enabledIndex = normalizedProfiles.findIndex((profile) => profile.enabled);
    const nextProfiles = normalizedProfiles.map((profile, index) => ({
      ...profile,
      enabled: index === enabledIndex,
    }));

    setStatus(null);
    setSaving(true);

    try {
      const [apiResult, globalResult] = await Promise.all([
        window.electron.saveApiConfig({ profiles: nextProfiles }),
        window.electron.saveGlobalConfig(normalizedGlobalConfig),
      ]);
      const failures: string[] = [];

      if (!apiResult.success) {
        failures.push(apiResult.error || "保存模型配置失败。");
      }
      if (!globalResult.success) {
        failures.push(globalResult.error || "保存全局配置失败。");
      }

      if (failures.length > 0) {
        setStatus({ tone: "error", message: failures.join("；") });
      } else {
        setApiConfigSettings({ profiles: nextProfiles });
        setProfiles(nextProfiles);
        setStatus({ tone: "success", message: "设置已保存。" });
      }
    } catch (err) {
      console.error("Failed to save settings:", err);
      setStatus({ tone: "error", message: "保存配置失败。" });
    } finally {
      setSaving(false);
    }
  };

  let content = <ApiProfilesSettingsPage profiles={profiles} onChange={updateProfiles} />;
  if (activePageId === "routing") {
    content = <ModelRoutingSettingsPage profiles={profiles} onChange={updateProfiles} />;
  }
  if (activePageId === "global-json") {
    content = (
      <GlobalJsonSettingsPage
        configText={globalConfigText}
        parseError={globalConfigParseError}
        onChange={handleGlobalConfigChange}
        onFormat={handleFormatGlobalConfig}
      />
    );
  }

  return (
    <SettingsSheet
      title="设置"
      description="统一的设置抽屉，负责承载不同配置页。后续继续扩展组件时，只需要新增页面和区块，不需要重写容器。"
      pages={pages}
      activePageId={activePageId}
      onPageChange={(pageId) => {
        setStatus(null);
        setActivePageId(pageId as SettingsPageId);
      }}
      onClose={onClose}
      status={status}
      footer={(
        <div className="flex gap-3">
          <button
            type="button"
            className="rounded-xl border border-ink-900/10 bg-white px-4 py-2.5 text-sm font-medium text-ink-700 transition-colors hover:bg-surface"
            onClick={onClose}
          >
            关闭
          </button>
          <button
            type="button"
            className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white shadow-soft transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => { void handleSave(); }}
            disabled={saving || loading}
          >
            {saving ? (
              <svg aria-hidden="true" className="mx-auto h-5 w-5 animate-spin" viewBox="0 0 100 101" fill="none">
                <path d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z" fill="currentColor" opacity="0.3" />
                <path d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z" fill="white" />
              </svg>
            ) : "保存"}
          </button>
        </div>
      )}
    >
      {loading ? (
        <div className="flex min-h-[320px] items-center justify-center">
          <svg aria-hidden="true" className="h-6 w-6 animate-spin text-accent" viewBox="0 0 100 101" fill="none">
            <path d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z" fill="currentColor" opacity="0.3" />
            <path d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z" fill="currentColor" />
          </svg>
        </div>
      ) : content}
    </SettingsSheet>
  );
}
