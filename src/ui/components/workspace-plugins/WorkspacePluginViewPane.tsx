import { useCallback, useEffect, useRef, useState } from "react";
import type { WorkspacePluginDescriptor } from "../../../shared/workspace-plugins";
import type { WorkspacePluginLaunch } from "../../../electron/libs/workspace-plugins/workspace-plugin-manager";

type WorkspacePluginViewPaneProps = {
  plugin: WorkspacePluginDescriptor;
  sessionId?: string;
};

function getSurfaceId(pluginId: string, sessionId: string) {
  return `workspace-plugin:${pluginId}:${sessionId}`;
}

function canUsePluginBrowserView() {
  return typeof window !== "undefined" &&
    typeof window.electron?.workspacePlugins?.open === "function" &&
    typeof window.electron?.openBrowserWorkbench === "function" &&
    typeof window.electron?.setBrowserWorkbenchBounds === "function";
}

export function WorkspacePluginViewPane({ plugin, sessionId }: WorkspacePluginViewPaneProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [launch, setLaunch] = useState<WorkspacePluginLaunch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const surfaceId = sessionId ? getSurfaceId(plugin.id, sessionId) : null;

  const syncBounds = useCallback(() => {
    if (!surfaceId || !canUsePluginBrowserView()) return;
    const element = surfaceRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    void window.electron.setBrowserWorkbenchBounds({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    }, surfaceId);
  }, [surfaceId]);

  useEffect(() => {
    if (!sessionId || !surfaceId) {
      setLaunch(null);
      setError("请先打开一个带工作目录的会话。");
      return;
    }
    if (!canUsePluginBrowserView()) {
      setLaunch(null);
      setError("当前运行环境不支持插件工作区，请在桌面应用中打开。");
      return;
    }

    let cancelled = false;
    setLaunch(null);
    setError(null);
    void (async () => {
      try {
        const launch = await window.electron.workspacePlugins.open({ pluginId: plugin.id, sessionId });
        await window.electron.openBrowserWorkbench(launch.url, surfaceId);
        if (cancelled) return;
        setLaunch(launch);
      } catch (openError) {
        if (cancelled) return;
        setError(openError instanceof Error ? openError.message : String(openError));
      }
    })();

    return () => {
      cancelled = true;
      void window.electron.setBrowserWorkbenchBounds({ x: 0, y: 0, width: 0, height: 0 }, surfaceId);
    };
  }, [plugin.id, sessionId, surfaceId]);

  useEffect(() => {
    if (!launch || !surfaceId) return;
    const element = surfaceRef.current;
    if (!element) return;
    const observer = new ResizeObserver(syncBounds);
    observer.observe(element);
    window.addEventListener("resize", syncBounds);
    syncBounds();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncBounds);
    };
  }, [launch, surfaceId, syncBounds]);

  return (
    <div ref={surfaceRef} className="relative h-full w-full overflow-hidden bg-white">
      {!launch && !error && (
        <div className="grid h-full place-items-center px-6 text-center text-sm text-ink-500">
          正在启动 {plugin.label}…
        </div>
      )}
      {error && (
        <div className="grid h-full place-items-center px-6 text-center">
          <div className="max-w-sm rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
            {plugin.label} 未能启动：{error}
          </div>
        </div>
      )}
    </div>
  );
}
