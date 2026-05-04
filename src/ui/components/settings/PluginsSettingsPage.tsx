import { ExternalLink, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

type PluginStatus = "planned" | "not-installed" | "needs-permission" | "ready";

type DefaultPlugin = {
  id: string;
  name: string;
  kind: string;
  version: string;
  description: string;
  repository: string;
  sourcePath: string;
  status: PluginStatus;
  permissions: string[];
};

type PluginInstallResult = {
  success: boolean;
  installed: boolean;
  connected: boolean;
  version?: string;
  message: string;
  error?: string;
  permissions?: OpenComputerUsePermissionStatus;
};

type OpenComputerUsePermissionStatus = {
  platform: string;
  required: boolean;
  accessibility: "granted" | "missing" | "not-required" | "unknown";
  screenRecording: "granted" | "missing" | "not-required" | "unknown";
  needsUserAction: boolean;
  openedSystemSettings: boolean;
};

type PluginRuntimeStatus = {
  installed: boolean;
  connected: boolean;
  version?: string;
  permissions?: OpenComputerUsePermissionStatus;
};

const DEFAULT_PLUGINS: DefaultPlugin[] = [
  {
    id: "open-computer-use",
    name: "Open Computer Use",
    kind: "mcp-plugin",
    version: "0.1.36",
    description: "本机桌面控制 MCP 插件，作为插件体系的第一颗默认插件。",
    repository: "https://github.com/iFurySt/open-codex-computer-use",
    sourcePath: "plugins/open-computer-use",
    status: "planned",
    permissions: ["mcp.server", "desktop.read", "desktop.write", "accessibility", "screen-recording"],
  },
];

const statusMeta: Record<PluginStatus, { label: string; className: string }> = {
  planned: {
    label: "未接入",
    className: "border-blue-500/20 bg-blue-50 text-blue-700",
  },
  "not-installed": {
    label: "未安装",
    className: "border-amber-500/20 bg-amber-50 text-amber-800",
  },
  "needs-permission": {
    label: "待授权",
    className: "border-orange-500/20 bg-orange-50 text-orange-800",
  },
  ready: {
    label: "可用",
    className: "border-emerald-500/20 bg-emerald-50 text-emerald-700",
  },
};

export function PluginsSettingsPage() {
  const [installingPluginId, setInstallingPluginId] = useState<string | null>(null);
  const [installResult, setInstallResult] = useState<PluginInstallResult | null>(null);
  const [runtimeStatus, setRuntimeStatus] = useState<PluginRuntimeStatus | null>(null);

  useEffect(() => {
    let mounted = true;
    void (window.electron as typeof window.electron & {
      invoke: (channel: string, ...args: unknown[]) => Promise<PluginRuntimeStatus>;
    }).invoke("plugins:getOpenComputerUseStatus")
      .then((status) => {
        if (mounted) setRuntimeStatus(status as PluginRuntimeStatus);
      })
      .catch(() => {
        if (mounted) setRuntimeStatus({ installed: false, connected: false });
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleInstall = (plugin: DefaultPlugin) => {
    void (async () => {
      setInstallingPluginId(plugin.id);
      setInstallResult(null);
      try {
        const result = await (window.electron as typeof window.electron & {
          invoke: (channel: string, ...args: unknown[]) => Promise<PluginInstallResult>;
        }).invoke("plugins:installOpenComputerUse") as PluginInstallResult;
        setInstallResult(result);
        setRuntimeStatus({
          installed: result.installed,
          connected: result.connected,
          version: result.version,
          permissions: result.permissions,
        });
      } catch (error) {
        setInstallResult({
          success: false,
          installed: false,
          connected: false,
          message: "插件安装请求失败。",
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        setInstallingPluginId(null);
      }
    })();
  };

  return (
    <section className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E5E6EB] pb-5">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-[#8A94A6]">PLUGIN RUNTIME</div>
          <h2 className="mt-2 text-xl font-bold tracking-tight text-[#1D2129]">插件系统</h2>
          <p className="mt-1.5 max-w-3xl text-sm leading-6 text-[#6B778C]">
            管理默认插件、MCP 能力、权限和扩展来源。
          </p>
        </div>
        <a
          href="https://github.com/iFurySt/open-codex-computer-use"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-[#DADDE5] bg-white px-3 py-2 text-sm font-semibold text-[#1D2129] transition hover:border-[#C9CDD4] hover:bg-[#F7F8FA]"
        >
          <ExternalLink className="h-4 w-4" />
          默认插件仓库
        </a>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#E5E6EB] bg-white shadow-[0_12px_28px_rgba(24,32,46,0.04)]">
        <div className="grid min-w-[1040px] grid-cols-[minmax(320px,1fr)_140px_130px_190px_130px] border-b border-[#E5E6EB] bg-[#F7F8FA] px-4 py-3 text-xs font-bold uppercase tracking-[0.08em] text-[#8A94A6]">
          <span>插件</span>
          <span>类型</span>
          <span>状态</span>
          <span>来源</span>
          <span>操作</span>
        </div>

        {DEFAULT_PLUGINS.map((plugin) => {
          const connected = runtimeStatus?.connected === true || (installResult?.success && installResult.connected);
          const installed = runtimeStatus?.installed === true || installResult?.installed === true;
          const permissions = installResult?.permissions ?? runtimeStatus?.permissions;
          const needsPermission = Boolean(permissions?.required && permissions.needsUserAction);
          const status = connected
            ? statusMeta.ready
            : needsPermission
              ? statusMeta["needs-permission"]
              : installed
                ? statusMeta.planned
                : statusMeta["not-installed"];
          const actionLabel = installingPluginId === plugin.id
            ? "处理中..."
            : connected
              ? "重新检测"
              : needsPermission
                ? "授权"
                : installed
                  ? "接入"
                  : "安装";
          return (
            <article
              key={plugin.id}
              className="grid min-w-[1040px] grid-cols-[minmax(320px,1fr)_140px_130px_190px_130px] items-start gap-4 px-4 py-4"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-bold text-[#1D2129]">{plugin.name}</h3>
                    <span className="rounded-full border border-[#E5E6EB] bg-[#F7F8FA] px-2 py-0.5 text-xs font-semibold text-[#4E5969]">
                      v{runtimeStatus?.version ?? plugin.version}
                  </span>
                </div>
                <p className="mt-1 text-sm leading-5 text-[#6B778C]">{plugin.description}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {plugin.permissions.map((permission) => (
                    <span
                      key={permission}
                      className="rounded-md border border-[#DADDE5] bg-white px-2 py-0.5 text-xs font-medium text-[#4E5969]"
                    >
                      {permission}
                    </span>
                  ))}
                </div>
              </div>

              <span className="mt-1 rounded-full border border-[#E5E6EB] bg-[#F7F8FA] px-2.5 py-1 text-xs font-semibold text-[#4E5969]">
                {plugin.kind}
              </span>

              <span className={`mt-1 w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${status.className}`}>
                {status.label}
              </span>

              <div className="min-w-0 text-sm leading-5 text-[#6B778C]">
                <div className="truncate font-medium text-[#1D2129]">GitHub</div>
                <div className="mt-1 truncate text-xs">{plugin.sourcePath}</div>
                <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-[#0E7490]">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {plugin.permissions.length} 权限
                </div>
                {needsPermission && (
                  <div className="mt-1 text-xs font-medium text-orange-700">
                    macOS 需授权 Accessibility / Screen Recording
                  </div>
                )}
              </div>

              <button
                type="button"
                className="mt-0.5 rounded-lg bg-[#1D2129] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#2B303B] disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => handleInstall(plugin)}
                disabled={installingPluginId === plugin.id}
              >
                {actionLabel}
              </button>
            </article>
          );
        })}
      </div>
      {installResult && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${
          installResult.success
            ? "border-emerald-500/20 bg-emerald-50 text-emerald-700"
            : "border-red-500/20 bg-red-50 text-red-700"
        }`}>
          {installResult.message}
          {installResult.version ? ` 当前版本：${installResult.version}` : ""}
          {installResult.error ? ` ${installResult.error}` : ""}
        </div>
      )}
    </section>
  );
}
