import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEV_BROWSER_PREVIEW_FLAG, getDevElectronRuntimeSource } from "../dev-electron-shim";
import { useAppStore } from "../store/useAppStore";
import { shouldAttachBrowserWorkbench } from "../utils/browser-workbench-visibility";
import { normalizeWorkbenchUrl } from "../utils/workbench-url";

type BrowserWorkbenchPageProps = {
  active?: boolean;
  initialUrl?: string;
  occluded?: boolean;
  sessionId?: string | null;
  onOpenTrace?: () => void;
  onOpenUsage?: () => void;
};

const defaultBrowserState: BrowserWorkbenchState = {
  url: "",
  title: "",
  loading: false,
  canGoBack: false,
  canGoForward: false,
  annotationMode: false,
};

const isBrowserPreviewRuntime = () => (
  typeof window !== "undefined" &&
  (!/Electron/i.test(window.navigator.userAgent) || getDevElectronRuntimeSource() !== "electron")
);

const hasBrowserWorkbenchRuntime = () => (
  typeof window !== "undefined" &&
  typeof window.electron?.openBrowserWorkbench === "function" &&
  typeof window.electron?.setBrowserWorkbenchBounds === "function"
);

type LocalBrowserTarget = {
  id: string;
  title: string;
  host: string;
  url: string;
};

const LOCAL_BROWSER_TARGETS: LocalBrowserTarget[] = [
  { id: "tech-cc-hub", title: "tech-cc-hub", host: "localhost:4173", url: "http://localhost:4173/" },
  { id: "new-api", title: "New API", host: "localhost:5337", url: "http://localhost:5337/" },
  { id: "litellm", title: "LiteLLM API - Swagger UI", host: "localhost:4000", url: "http://localhost:4000/" },
  { id: "localhost-8000", title: "localhost:8000", host: "localhost:8000", url: "http://localhost:8000/" },
  { id: "localhost-8001", title: "localhost:8001", host: "localhost:8001", url: "http://localhost:8001/" },
];

type LocalTargetStatus = "checking" | "online" | "offline";

async function probeLocalTarget(url: string, timeoutMs = 1400): Promise<LocalTargetStatus> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    await fetch(url, {
      cache: "no-store",
      mode: "no-cors",
      signal: controller.signal,
    });
    return "online";
  } catch {
    return "offline";
  } finally {
    window.clearTimeout(timeout);
  }
}

function LocalTargetPreview({ target }: { target: LocalBrowserTarget }) {
  return (
    <div className="grid h-[74px] w-[120px] shrink-0 place-items-center rounded-[14px] border border-black/8 bg-[#f8fafc] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
      <div className="h-[54px] w-[92px] rounded-md border border-black/10 bg-white px-2 py-1.5 shadow-sm">
        <div className="mb-2 flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-[#ff6b5f]" />
          <span className="h-1.5 w-1.5 rounded-full bg-[#ffc043]" />
          <span className="h-1.5 w-1.5 rounded-full bg-[#31c46a]" />
        </div>
        <div className="mb-1.5 h-1.5 rounded-full bg-ink-900/14" />
        <div className="mb-2 h-1.5 w-14 rounded-full bg-ink-900/18" />
        <div className="truncate text-[8px] font-semibold leading-none text-ink-800">{target.title}</div>
        <div className="mt-0.5 truncate text-[7px] leading-none text-muted">{target.host}</div>
      </div>
    </div>
  );
}

function isCurrentAppUrl(value: string) {
  if (!value.trim() || typeof window === "undefined") return false;
  try {
    const target = new URL(normalizeWorkbenchUrl(value) ?? value, window.location.href);
    const current = new URL(window.location.href);
    return target.origin === current.origin && target.pathname === current.pathname;
  } catch {
    return false;
  }
}

function toBrowserWorkbenchUrl(value: string) {
  if (!isCurrentAppUrl(value)) return value;
  try {
    const target = new URL(normalizeWorkbenchUrl(value) ?? value, window.location.href);
    target.searchParams.set(DEV_BROWSER_PREVIEW_FLAG, "1");
    return target.href;
  } catch {
    return value;
  }
}

export function BrowserWorkbenchPage({
  active = true,
  initialUrl = "",
  occluded = false,
  sessionId = null,
  onOpenTrace,
  onOpenUsage,
}: BrowserWorkbenchPageProps) {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const hasOpenedRef = useRef(false);
  const initialUrlRef = useRef(initialUrl);
  const sessionIdRef = useRef(sessionId);
  const sessionBrowserState = useAppStore((store) => (sessionId ? store.browserWorkbenchBySessionId[sessionId] : undefined));
  const setSessionBrowserUrl = useAppStore((store) => store.setBrowserWorkbenchUrl);
  const setSessionBrowserHasTab = useAppStore((store) => store.setBrowserWorkbenchHasTab);
  const setSessionBrowserAnnotations = useAppStore((store) => store.setBrowserWorkbenchAnnotations);
  const [url, setUrl] = useState(() => normalizeWorkbenchUrl(sessionBrowserState?.url || initialUrl) ?? sessionBrowserState?.url ?? initialUrl);
  const [state, setState] = useState<BrowserWorkbenchState>(defaultBrowserState);
  const [annotations, setAnnotations] = useState<BrowserWorkbenchAnnotation[]>(() => sessionBrowserState?.annotations ?? []);
  const [hasBrowserTab, setHasBrowserTab] = useState(() => sessionBrowserState?.hasBrowserTab ?? Boolean(sessionBrowserState?.url || initialUrl));
  const [statusText, setStatusText] = useState("准备打开页面");
  const [isPreviewRuntime] = useState(isBrowserPreviewRuntime);
  const [hasBrowserRuntime] = useState(hasBrowserWorkbenchRuntime);
  const [localTargetStatus, setLocalTargetStatus] = useState<Record<string, LocalTargetStatus>>({});
  const canUseBrowserView = hasBrowserRuntime && !isPreviewRuntime;
  const [isDevToolsOpen, setIsDevToolsOpen] = useState(false);
  const showBrowserChrome = hasBrowserTab || active;
  const currentBrowserUrl = state.url || url;
  const hasCurrentUrl = Boolean(currentBrowserUrl.trim());
  const hasExternalBrowserUrl = hasCurrentUrl;
  const browserActive = shouldAttachBrowserWorkbench({ active, hasBrowserTab: hasBrowserTab && hasExternalBrowserUrl, occluded });
  const showLocalLauncher = showBrowserChrome && !hasExternalBrowserUrl;
  const previewUrl = isPreviewRuntime ? (state.url || url) : "";

  const persistUrl = useCallback((nextUrl: string) => {
    if (sessionId) setSessionBrowserUrl(sessionId, nextUrl);
  }, [sessionId, setSessionBrowserUrl]);

  const persistAnnotations = useCallback((nextAnnotations: BrowserWorkbenchAnnotation[]) => {
    if (sessionId) setSessionBrowserAnnotations(sessionId, nextAnnotations);
  }, [sessionId, setSessionBrowserAnnotations]);

  const syncBounds = useCallback(() => {
    if (!canUseBrowserView) return;
    if (!browserActive) {
      void window.electron.setBrowserWorkbenchBounds({ x: 0, y: 0, width: 0, height: 0 }, sessionId ?? undefined);
      return;
    }
    const element = surfaceRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    void window.electron.setBrowserWorkbenchBounds({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    }, sessionId ?? undefined);
  }, [browserActive, canUseBrowserView, sessionId]);

  useEffect(() => {
    const ownedSessionId = sessionId;
    return () => {
      if (!hasBrowserRuntime || isPreviewRuntime) return;
      void window.electron.setBrowserWorkbenchBounds(
        { x: 0, y: 0, width: 0, height: 0 },
        ownedSessionId ?? undefined,
      );
    };
  }, [hasBrowserRuntime, isPreviewRuntime, sessionId]);

  const openUrl = useCallback(async (nextUrl = url) => {
    const rawTargetUrl = normalizeWorkbenchUrl(nextUrl) ?? nextUrl.trim();
    const targetUrl = toBrowserWorkbenchUrl(rawTargetUrl);
    if (!targetUrl) {
      setHasBrowserTab(true);
      if (sessionId) setSessionBrowserHasTab(sessionId, true);
      setState(defaultBrowserState);
      setUrl("");
      persistUrl("");
      setStatusText("请输入页面地址");
      if (hasBrowserRuntime) {
        await window.electron.closeBrowserWorkbenchDevTools(sessionId ?? undefined);
        await window.electron.closeBrowserWorkbench(sessionId ?? undefined);
      }
      return;
    }
    if (isPreviewRuntime) {
      setState({
        url: targetUrl,
        title: "Codex 网页预览态",
        loading: false,
        canGoBack: false,
        canGoForward: false,
        annotationMode: false,
      });
      setUrl(targetUrl);
      persistUrl(targetUrl);
      setStatusText("网页预览态不挂载 Electron BrowserView");
      return;
    }
    if (!hasBrowserRuntime) {
      setStatusText("当前 Electron 主进程还没有浏览器工作台能力，请重启应用后再试");
      return;
    }
    syncBounds();
    setUrl(targetUrl);
    persistUrl(targetUrl);
    const nextState = await window.electron.openBrowserWorkbench(targetUrl, sessionId ?? undefined);
    setState(nextState);
    const finalUrl = nextState.url || targetUrl;
    setUrl(finalUrl);
    persistUrl(finalUrl);
    setStatusText(nextState.url ? "页面已打开" : "准备打开页面");
    setIsDevToolsOpen(false);
  }, [hasBrowserRuntime, isPreviewRuntime, persistUrl, sessionId, syncBounds, url]);

  useEffect(() => {
    const sessionChanged = sessionIdRef.current !== sessionId;
    sessionIdRef.current = sessionId;
    setAnnotations(sessionBrowserState?.annotations ?? []);
    setHasBrowserTab(sessionBrowserState?.hasBrowserTab ?? Boolean(sessionBrowserState?.url || initialUrl));
    if (sessionChanged) {
      const nextUrl = normalizeWorkbenchUrl(sessionBrowserState?.url || initialUrl) ?? sessionBrowserState?.url ?? initialUrl;
      setState(defaultBrowserState);
      setUrl(nextUrl);
      hasOpenedRef.current = false;
    }
  }, [initialUrl, sessionBrowserState?.annotations, sessionBrowserState?.hasBrowserTab, sessionId]);

  useEffect(() => {
    if (initialUrlRef.current === initialUrl) return;
    initialUrlRef.current = initialUrl;
    const nextUrl = normalizeWorkbenchUrl(initialUrl) ?? initialUrl;
    setUrl(nextUrl);
    persistUrl(nextUrl);
    if (active && hasBrowserTab && nextUrl) {
      hasOpenedRef.current = false;
      void openUrl(nextUrl);
    }
  }, [active, hasBrowserTab, initialUrl, openUrl, persistUrl]);

  useEffect(() => {
    const unsubscribe = window.electron.onBrowserWorkbenchEvent((event) => {
      if (event.sessionId && sessionId && event.sessionId !== sessionId) return;
      if (event.type === "browser.state") {
        setState(event.payload);
        if (event.payload.url) {
          setUrl(event.payload.url);
          persistUrl(event.payload.url);
        }
        return;
      }
      if (event.type === "browser.console") return;
      if (event.type === "browser.annotation") {
        if (event.payload.removed) {
          setAnnotations((current) => {
            const next = current.filter((item) => item.id !== event.payload.id);
            persistAnnotations(next);
            return next;
          });
          setStatusText("已取消页面标注");
          return;
        }
        setAnnotations((current) => {
          const existingIndex = current.findIndex((item) => item.id === event.payload.id);
          let next: BrowserWorkbenchAnnotation[];
          if (existingIndex >= 0) {
            next = [...current];
            next[existingIndex] = { ...next[existingIndex], ...event.payload };
          } else {
            next = [event.payload, ...current].slice(0, 30);
          }
          persistAnnotations(next);
          return next;
        });
        setStatusText("已捕获页面标注");
      }
    });

    return unsubscribe;
  }, [persistAnnotations, persistUrl, sessionId]);

  useEffect(() => {
    const element = surfaceRef.current;
    if (!element) return;

    const observer = new ResizeObserver(() => {
      syncBounds();
      if (browserActive && !hasOpenedRef.current && (url || initialUrl)) {
        hasOpenedRef.current = true;
        void openUrl(url || initialUrl);
      }
    });

    observer.observe(element);
    window.addEventListener("resize", syncBounds);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncBounds);
    };
  }, [browserActive, initialUrl, openUrl, syncBounds, url]);

  useEffect(() => {
    if (!hasBrowserRuntime) return;
    if (isPreviewRuntime) {
      if (browserActive && !hasOpenedRef.current && (url || initialUrl)) {
        hasOpenedRef.current = true;
        void openUrl(url || initialUrl);
      }
      return;
    }
    if (!browserActive) {
      void window.electron.setBrowserWorkbenchBounds({ x: 0, y: 0, width: 0, height: 0 }, sessionId ?? undefined);
      return;
    }
    syncBounds();
    if (!hasOpenedRef.current && (url || initialUrl)) {
      hasOpenedRef.current = true;
      void openUrl(url || initialUrl);
    }
  }, [browserActive, hasBrowserRuntime, initialUrl, isPreviewRuntime, openUrl, syncBounds, url]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void openUrl(url);
  };

  const handleReload = async () => {
    if (!canUseBrowserView) {
      setStatusText(isPreviewRuntime ? "预览态不刷新 BrowserView" : "浏览器工作台尚未就绪");
      return;
    }
    const nextState = await window.electron.reloadBrowserWorkbench(sessionId ?? undefined);
    setState(nextState);
  };

  const handleBack = async () => {
    if (!canUseBrowserView) return;
    const nextState = await window.electron.goBackBrowserWorkbench(sessionId ?? undefined);
    setState(nextState);
  };

  const handleForward = async () => {
    if (!canUseBrowserView) return;
    const nextState = await window.electron.goForwardBrowserWorkbench(sessionId ?? undefined);
    setState(nextState);
  };

  const handleCapture = async () => {
    if (!hasBrowserRuntime) {
      setStatusText("当前 Electron 主进程还没有截图能力，请重启应用后再试");
      return;
    }
    if (isPreviewRuntime) {
      setStatusText("Codex 内置浏览器不能截图 Electron BrowserView");
      return;
    }
    const result = await window.electron.captureBrowserWorkbenchVisible(sessionId ?? undefined);
    setStatusText(result.success && result.dataUrl ? "截图已捕获" : result.error || "截图失败");
  };

  const handleToggleDevTools = async () => {
    if (!hasBrowserRuntime) {
      setStatusText("当前 Electron 主进程还没有检查器能力，请重启应用后再试");
      return;
    }
    if (isPreviewRuntime) {
      setStatusText("预览态不能打开 Electron BrowserView 检查器");
      return;
    }
    const nextState = isDevToolsOpen
      ? await window.electron.closeBrowserWorkbenchDevTools(sessionId ?? undefined)
      : await window.electron.openBrowserWorkbenchDevTools(sessionId ?? undefined);
    setIsDevToolsOpen(nextState.opened);
    setStatusText(nextState.opened ? "检查器已打开" : "检查器已关闭");
  };

  const handleToggleAnnotation = async () => {
    if (!hasBrowserRuntime) {
      setStatusText("当前 Electron 主进程还没有标注能力，请重启应用后再试");
      return;
    }
    if (isPreviewRuntime) {
      setStatusText("Codex 内置浏览器不能嵌套 Electron BrowserView 标注");
      return;
    }
    const nextState = await window.electron.setBrowserWorkbenchAnnotationMode(!state.annotationMode, sessionId ?? undefined);
    setState(nextState);
    setStatusText(nextState.annotationMode ? "标注模式已开启" : "标注模式已关闭");
  };

  const handleCloseBrowserTab = async () => {
    setHasBrowserTab(false);
    if (sessionId) setSessionBrowserHasTab(sessionId, false);
    hasOpenedRef.current = false;
    setState(defaultBrowserState);
    setUrl("");
    persistUrl("");
    setAnnotations([]);
    persistAnnotations([]);
    setIsDevToolsOpen(false);
    setStatusText("浏览器标签已关闭");
    if (hasBrowserRuntime) {
      await window.electron.closeBrowserWorkbenchDevTools(sessionId ?? undefined);
      await window.electron.closeBrowserWorkbench(sessionId ?? undefined);
    }
  };

  const handleCreateBrowserTab = async () => {
    setHasBrowserTab(true);
    if (sessionId) setSessionBrowserHasTab(sessionId, true);
    hasOpenedRef.current = false;
    setState(defaultBrowserState);
    setUrl("");
    persistUrl("");
    setAnnotations([]);
    persistAnnotations([]);
    setIsDevToolsOpen(false);
    setStatusText("已打开本地启动页");
    if (hasBrowserRuntime) {
      await window.electron.closeBrowserWorkbenchDevTools(sessionId ?? undefined);
      await window.electron.closeBrowserWorkbench(sessionId ?? undefined);
    }
  };
  const handleOpenLocalTarget = useCallback((targetUrl: string) => {
    const browserTargetUrl = toBrowserWorkbenchUrl(targetUrl);
    setHasBrowserTab(true);
    if (sessionId) setSessionBrowserHasTab(sessionId, true);
    setUrl(browserTargetUrl);
    persistUrl(browserTargetUrl);
    hasOpenedRef.current = false;
    setStatusText("正在打开本地页面");
  }, [persistUrl, sessionId, setSessionBrowserHasTab]);
  const localTargets = useMemo(() => {
    if (typeof window === "undefined") return LOCAL_BROWSER_TARGETS;
    let currentHost = "";
    try {
      currentHost = new URL(window.location.href).host;
    } catch {
      currentHost = "";
    }
    return LOCAL_BROWSER_TARGETS.map((target) => ({
      ...target,
      current: target.host === currentHost,
    }));
  }, []);
  const showBrowserSurface = showBrowserChrome;

  useEffect(() => {
    let cancelled = false;
    setLocalTargetStatus(Object.fromEntries(LOCAL_BROWSER_TARGETS.map((target) => [target.id, "checking" as const])));
    void Promise.all(
      LOCAL_BROWSER_TARGETS.map(async (target) => {
        const status = await probeLocalTarget(target.url);
        if (cancelled) return;
        setLocalTargetStatus((current) => ({ ...current, [target.id]: status }));
      }),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white/82">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-black/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(250,251,253,0.92))] px-4 backdrop-blur-xl">
        <div className="flex min-w-0 items-center gap-1.5">
          {showBrowserChrome && (
            <button
              type="button"
              className="group inline-flex h-8 items-center gap-2 rounded-xl bg-ink-900/7 px-3 text-[13px] font-medium text-ink-900 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.05)] transition"
              title="浏览器"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <circle cx="12" cy="12" r="8.5" />
                <path d="M3.5 12h17M12 3.5c2.2 2.3 3.2 5.1 3.2 8.5s-1 6.2-3.2 8.5M12 3.5C9.8 5.8 8.8 8.6 8.8 12s1 6.2 3.2 8.5" />
              </svg>
              <span className="max-w-[120px] truncate">{state.title || "浏览器"}</span>
              {hasBrowserTab && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    void handleCloseBrowserTab();
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    event.stopPropagation();
                    void handleCloseBrowserTab();
                  }}
                  className="ml-1 hidden h-4 w-4 items-center justify-center rounded-full text-ink-500 transition hover:bg-ink-900/10 hover:text-ink-900 group-hover:inline-flex"
                  title="关闭浏览器标签"
                  aria-label="关闭浏览器标签"
                >
                  x
                </span>
              )}
            </button>
          )}
          <button
            type="button"
            onClick={onOpenTrace}
            className="inline-flex h-8 items-center gap-2 rounded-xl px-3 text-[13px] font-medium text-muted transition hover:bg-ink-900/5 hover:text-ink-700"
            title="执行轨迹"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M5 5h14M5 12h10M5 19h7" />
            </svg>
            <span className="max-w-[160px] truncate">执行轨迹</span>
          </button>
          <button
            type="button"
            onClick={onOpenUsage}
            className="inline-flex h-8 items-center gap-2 rounded-xl px-3 text-[13px] font-medium text-muted transition hover:bg-ink-900/5 hover:text-ink-700"
            title="Usage"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M4 18V6M9 18v-7M14 18V9M19 18V4" />
            </svg>
            <span className="max-w-[160px] truncate">Usage</span>
          </button>
          <button
            type="button"
            onClick={handleCreateBrowserTab}
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-muted transition hover:bg-ink-900/5 hover:text-ink-700"
            title="新建本地浏览器页"
            aria-label="新建本地浏览器页"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
      </div>

      {showBrowserSurface ? (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-b border-black/8 bg-white/72 shadow-[0_24px_70px_rgba(30,38,52,0.08)] backdrop-blur-xl">
        <form onSubmit={handleSubmit} className="grid h-10 shrink-0 grid-cols-[auto_minmax(220px,720px)_auto] items-center gap-3 border-b border-black/8 bg-white/92 px-4">
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleBack} disabled={!state.canGoBack} className="inline-flex h-7 w-7 items-center justify-center rounded-full text-ink-500 transition hover:bg-ink-900/5 disabled:opacity-35" title="后退" aria-label="后退">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
            </button>
            <button type="button" onClick={handleForward} disabled={!state.canGoForward} className="inline-flex h-7 w-7 items-center justify-center rounded-full text-ink-500 transition hover:bg-ink-900/5 disabled:opacity-35" title="前进" aria-label="前进">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
            </button>
            <button type="button" onClick={handleReload} className="inline-flex h-7 w-7 items-center justify-center rounded-full text-ink-500 transition hover:bg-ink-900/5" title="刷新" aria-label="刷新">
              <svg viewBox="0 0 24 24" className={`h-4 w-4 ${state.loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.34-5.66" /><path d="M20 4v6h-6" /></svg>
            </button>
          </div>
          <div className="mx-auto flex h-8 min-w-0 w-full items-center justify-center gap-2 rounded-full border border-black/10 bg-white/92 px-3 text-xs text-ink-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${state.loading ? "bg-amber-500" : "bg-accent"}`} />
            <input value={url} onChange={(event) => setUrl(event.target.value)} className="min-w-0 flex-1 bg-transparent text-[12px] text-ink-700 outline-none placeholder:text-muted" placeholder="输入 URL" />
          </div>
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={handleToggleDevTools} disabled={!canUseBrowserView} className={`inline-flex h-8 w-8 items-center justify-center rounded-full border text-ink-700 transition disabled:opacity-50 ${isDevToolsOpen ? "border-accent/40 bg-accent-subtle text-accent" : "border-black/10 bg-white hover:bg-ink-900/5"}`} title={isDevToolsOpen ? "关闭检查器" : "打开检查器"} aria-label={isDevToolsOpen ? "关闭检查器" : "打开检查器"}>
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M4 5.5h16v10H4z" />
                <path d="M8 19h8M12 15.5V19" />
              </svg>
            </button>
            <button type="button" onClick={handleCapture} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/10 bg-white text-ink-700 transition hover:bg-ink-900/5" title="截图" aria-label="截图">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M4 8a2 2 0 0 1 2-2h2l1.4-1.8A2 2 0 0 1 11 3.5h2a2 2 0 0 1 1.6.7L16 6h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z" />
                <circle cx="12" cy="12.5" r="3" />
              </svg>
            </button>
            <button type="button" onClick={handleToggleAnnotation} className={`relative inline-flex h-8 w-8 items-center justify-center rounded-full border transition ${state.annotationMode ? "border-accent/30 bg-accent-subtle text-accent" : "border-black/10 bg-white text-ink-700 hover:bg-ink-900/5"}`} title={state.annotationMode ? "关闭标注" : "开启标注"} aria-label={state.annotationMode ? "关闭标注" : "开启标注"}>
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                <line x1="12" y1="8" x2="12" y2="14" />
                <line x1="9" y1="11" x2="15" y2="11" />
              </svg>
              {annotations.length > 0 && (
                <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[9px] font-bold leading-none text-white">
                  {annotations.length}
                </span>
              )}
            </button>
          </div>
        </form>
        <div className="sr-only" aria-live="polite">{statusText}</div>

        <div className="min-h-0 flex-1 bg-white">
          <div className="relative h-full min-h-0">
            <div
              ref={surfaceRef}
              className={`absolute inset-0 ${hasBrowserTab && hasExternalBrowserUrl ? "block" : "pointer-events-none invisible"}`}
            />
            {!hasBrowserTab ? (
              <div className="flex h-full justify-center overflow-y-auto px-6 py-2">
                <div className="w-full max-w-[620px]">
                  <div className="mb-2 text-[15px] font-medium text-muted">本地</div>
                  <div className="grid gap-3">
                    {localTargets.map((target) => {
                      const status = localTargetStatus[target.id] ?? "checking";
                      return (
                        <button
                          key={target.id}
                          type="button"
                          onClick={() => handleOpenLocalTarget(target.url)}
                          className="group grid min-h-[98px] grid-cols-[auto_1fr_auto] items-center gap-5 rounded-[18px] border border-black/8 bg-white px-4 text-left shadow-sm transition hover:border-black/14 hover:bg-[#f7f8fa] hover:shadow-[0_12px_32px_rgba(30,38,52,0.08)]"
                          aria-label={`打开 ${target.title}`}
                        >
                          <LocalTargetPreview target={target} />
                          <div className="min-w-0">
                            <div className="truncate text-[18px] font-semibold text-ink-900">{target.title}</div>
                            <div className="mt-1 truncate text-[17px] text-muted">{target.host}</div>
                          </div>
                          <div className="flex h-full flex-col items-end justify-center gap-4">
                            <span className={`h-2.5 w-2.5 rounded-full ${status === "online" ? "bg-[#00a63e]" : status === "offline" ? "bg-ink-900/18" : "animate-pulse bg-amber-500"}`} />
                            <span className="rounded-lg border border-black/8 bg-white px-3 py-1 text-sm font-medium text-muted transition group-hover:text-ink-800">
                              打开
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : isPreviewRuntime && previewUrl ? (
              <iframe
                src={previewUrl}
                title={state.title || "浏览器预览"}
                className="h-full w-full border-0 bg-white"
                sandbox="allow-downloads allow-forms allow-modals allow-popups allow-same-origin allow-scripts"
                onLoad={() => setStatusText("预览页面已打开")}
              />
            ) : !hasBrowserRuntime ? (
              <div className="grid h-full place-items-center p-6">
                <div className="w-full max-w-xl rounded-[14px] border border-dashed border-black/14 bg-white/78 px-6 py-8 text-center shadow-[0_16px_45px_rgba(30,38,52,0.08)]">
                  <div className="text-base font-semibold text-ink-800">需要重启 Electron</div>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">浏览器工作台依赖新的主进程和 preload IPC。重启桌面端后就能加载真实网页。</p>
                </div>
              </div>
            ) : showLocalLauncher && (
              <div className="flex h-full justify-center overflow-y-auto px-6 py-2">
                <div className="w-full max-w-[620px]">
                  <div className="mb-2 text-[15px] font-medium text-muted">本地</div>
                  <div className="grid gap-3">
                    {localTargets.map((target) => {
                      const status = localTargetStatus[target.id] ?? "checking";
                      return (
                        <button
                          key={target.id}
                          type="button"
                          onClick={() => handleOpenLocalTarget(target.url)}
                          className="group grid min-h-[98px] grid-cols-[auto_1fr_auto] items-center gap-5 rounded-[18px] border border-black/8 bg-white px-4 text-left shadow-sm transition hover:border-black/14 hover:bg-[#f7f8fa] hover:shadow-[0_12px_32px_rgba(30,38,52,0.08)]"
                          aria-label={`打开 ${target.title}`}
                        >
                          <LocalTargetPreview target={target} />
                          <div className="min-w-0">
                            <div className="truncate text-[18px] font-semibold text-ink-900">{target.title}</div>
                            <div className="mt-1 truncate text-[17px] text-muted">{target.host}</div>
                          </div>
                          <div className="flex h-full flex-col items-end justify-center gap-4">
                            <span className={`h-2.5 w-2.5 rounded-full ${status === "online" ? "bg-[#00a63e]" : status === "offline" ? "bg-ink-900/18" : "animate-pulse bg-amber-500"}`} />
                            <span className="rounded-lg border border-black/8 bg-white px-3 py-1 text-sm font-medium text-muted transition group-hover:text-ink-800">
                              打开
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      ) : (
        <div className="grid min-h-0 flex-1 place-items-center border-b border-black/8 bg-white/68 px-6 text-center">
          <div>
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-black/8 bg-white text-ink-600 shadow-sm">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <circle cx="12" cy="12" r="8.5" />
                <path d="M3.5 12h17M12 3.5c2.2 2.3 3.2 5.1 3.2 8.5s-1 6.2-3.2 8.5M12 3.5C9.8 5.8 8.8 8.6 8.8 12s1 6.2 3.2 8.5" />
              </svg>
            </div>
            <div className="mt-3 text-sm font-semibold text-ink-800">浏览器未打开</div>
            <div className="mt-1 text-xs text-muted">点击顶部加号后再输入地址。</div>
          </div>
        </div>
      )}
    </div>
  );
}
