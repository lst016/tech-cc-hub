import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useAppStore } from "../store/useAppStore";

type BrowserWorkbenchPageProps = {
  active?: boolean;
  initialUrl?: string;
};

type WorkbenchTab = {
  id: string;
  kind: "browser" | "review" | "file";
  title: string;
};

const WORKBENCH_TABS: WorkbenchTab[] = [
  { id: "overview", kind: "review", title: "概览" },
  { id: "review", kind: "review", title: "审查" },
];

const defaultBrowserState: BrowserWorkbenchState = {
  url: "",
  title: "",
  loading: false,
  canGoBack: false,
  canGoForward: false,
  annotationMode: false,
};

const isBrowserPreviewRuntime = () => (
  typeof window !== "undefined" && !/Electron/i.test(window.navigator.userAgent)
);

const hasBrowserWorkbenchRuntime = () => (
  typeof window !== "undefined" &&
  typeof window.electron?.openBrowserWorkbench === "function" &&
  typeof window.electron?.setBrowserWorkbenchBounds === "function"
);

export function BrowserWorkbenchPage({ active = true, initialUrl = "http://localhost:4173/" }: BrowserWorkbenchPageProps) {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const hasOpenedRef = useRef(false);
  const [url, setUrl] = useState(initialUrl);
  const [state, setState] = useState<BrowserWorkbenchState>(defaultBrowserState);
  const [annotations, setAnnotations] = useState<BrowserWorkbenchAnnotation[]>([]);
  const [hasBrowserTab, setHasBrowserTab] = useState(true);
  const [statusText, setStatusText] = useState("准备打开页面");
  const [isPreviewRuntime] = useState(isBrowserPreviewRuntime);
  const [hasBrowserRuntime] = useState(hasBrowserWorkbenchRuntime);
  const setBrowserAnnotations = useAppStore((store) => store.setBrowserAnnotations);
  const browserActive = active && hasBrowserTab;

  const syncBounds = useCallback(() => {
    if (!hasBrowserRuntime) return;
    if (!browserActive) {
      void window.electron.setBrowserWorkbenchBounds({ x: 0, y: 0, width: 0, height: 0 });
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
    });
  }, [browserActive, hasBrowserRuntime]);

  const openUrl = useCallback(async (nextUrl = url) => {
    if (!hasBrowserRuntime) {
      setStatusText("当前 Electron 主进程还是旧版本，请重启应用后再打开浏览器工作台");
      return;
    }
    syncBounds();
    const nextState = await window.electron.openBrowserWorkbench(nextUrl);
    setState(nextState);
    setUrl(nextState.url || nextUrl);
    setStatusText(isPreviewRuntime && nextState.url ? "当前是 Codex 网页预览，真实页面请在 Electron 窗口打开" : nextState.url ? "页面已打开" : "准备打开页面");
  }, [hasBrowserRuntime, isPreviewRuntime, syncBounds, url]);

  useEffect(() => {
    const unsubscribe = window.electron.onBrowserWorkbenchEvent((event) => {
      if (event.type === "browser.state") {
        setState(event.payload);
        if (event.payload.url) setUrl(event.payload.url);
        return;
      }
      if (event.type === "browser.console") {
        return;
      }
      if (event.type === "browser.annotation") {
        if (event.payload.removed) {
          setAnnotations((current) => {
            const next = current.filter((item) => item.id !== event.payload.id);
            setBrowserAnnotations(next);
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
          setBrowserAnnotations(next);
          return next;
        });
        setStatusText("已捕获页面标注");
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const element = surfaceRef.current;
    if (!element) return;

    const observer = new ResizeObserver(() => {
      syncBounds();
      if (browserActive && !hasOpenedRef.current) {
        hasOpenedRef.current = true;
        void openUrl(initialUrl);
      }
    });

    observer.observe(element);
    window.addEventListener("resize", syncBounds);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncBounds);
    };
  }, [browserActive, initialUrl, openUrl, syncBounds]);

  useEffect(() => {
    if (!hasBrowserRuntime) return;
    if (!browserActive) {
      void window.electron.setBrowserWorkbenchBounds({ x: 0, y: 0, width: 0, height: 0 });
      return;
    }
    syncBounds();
    if (!hasOpenedRef.current) {
      hasOpenedRef.current = true;
      void openUrl(initialUrl);
    }
  }, [browserActive, hasBrowserRuntime, initialUrl, openUrl, syncBounds]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void openUrl(url);
  };

  const handleReload = async () => {
    if (!hasBrowserRuntime) return;
    const nextState = await window.electron.reloadBrowserWorkbench();
    setState(nextState);
  };

  const handleBack = async () => {
    if (!hasBrowserRuntime) return;
    const nextState = await window.electron.goBackBrowserWorkbench();
    setState(nextState);
  };

  const handleForward = async () => {
    if (!hasBrowserRuntime) return;
    const nextState = await window.electron.goForwardBrowserWorkbench();
    setState(nextState);
  };

  const handleCapture = async () => {
    if (!hasBrowserRuntime) {
      setStatusText("当前 Electron 主进程还是旧版本，请重启应用后再截图");
      return;
    }
    const result = await window.electron.captureBrowserWorkbenchVisible();
    if (!result.success || !result.dataUrl) {
      setStatusText(result.error || "截图失败");
      return;
    }
    setStatusText("截图已捕获");
  };

  const handleToggleAnnotation = async () => {
    if (!hasBrowserRuntime) {
      setStatusText("当前 Electron 主进程还是旧版本，请重启应用后再开启标注");
      return;
    }
    const nextState = await window.electron.setBrowserWorkbenchAnnotationMode(!state.annotationMode);
    setState(nextState);
    setStatusText(nextState.annotationMode ? "标注模式已开启，点击页面元素生成评论线索" : "标注模式已关闭");
  };

  const handleCloseBrowserTab = async () => {
    setHasBrowserTab(false);
    hasOpenedRef.current = false;
    setState(defaultBrowserState);
    setAnnotations([]);
    setBrowserAnnotations([]);
    setStatusText("浏览器标签已关闭");
    if (hasBrowserRuntime) {
      await window.electron.closeBrowserWorkbench();
    }
  };

  const handleCreateBrowserTab = () => {
    if (hasBrowserTab) {
      setStatusText("当前工作台已经有一个浏览器标签");
      return;
    }
    setHasBrowserTab(true);
    setUrl(initialUrl);
    setStatusText("已新建浏览器标签");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white/82">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-black/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(250,251,253,0.92))] px-4 backdrop-blur-xl">
        <div className="flex min-w-0 items-center gap-1.5">
          {WORKBENCH_TABS.slice(0, 1).map((tab) => {
            const isActive = tab.id === "browser";
            return (
              <button
                key={tab.id}
                type="button"
                className={`inline-flex h-8 items-center gap-2 rounded-xl px-3 text-[13px] font-medium transition ${isActive ? "bg-ink-900/7 text-ink-900 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.05)]" : "text-muted hover:bg-ink-900/5 hover:text-ink-700"}`}
                title={tab.kind === "file" ? "文件预览" : tab.title}
              >
                {tab.kind === "browser" ? (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <circle cx="12" cy="12" r="8.5" />
                    <path d="M3.5 12h17M12 3.5c2.2 2.3 3.2 5.1 3.2 8.5s-1 6.2-3.2 8.5M12 3.5C9.8 5.8 8.8 8.6 8.8 12s1 6.2 3.2 8.5" />
                  </svg>
                ) : tab.kind === "file" ? (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <path d="M6 3.5h8l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 5 20V5A1.5 1.5 0 0 1 6.5 3.5Z" />
                    <path d="M14 3.5V8h4" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <path d="M5 5h14M5 12h10M5 19h7" />
                  </svg>
                )}
                <span className="max-w-[160px] truncate">{tab.title}</span>
              </button>
            );
          })}
          {hasBrowserTab && (
            <button
              type="button"
              className="group inline-flex h-8 items-center gap-2 rounded-xl bg-ink-900/7 px-3 text-[13px] font-medium text-ink-900 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.05)] transition"
              title="浏览器"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <circle cx="12" cy="12" r="8.5" />
                <path d="M3.5 12h17M12 3.5c2.2 2.3 3.2 5.1 3.2 8.5s-1 6.2-3.2 8.5M12 3.5C9.8 5.8 8.8 8.6 8.8 12s1 6.2 3.2 8.5" />
              </svg>
              <span className="max-w-[120px] truncate">tech-cc-hub</span>
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
                ×
              </span>
            </button>
          )}
          {WORKBENCH_TABS.slice(1).map((tab) => (
            <button
              key={tab.id}
              type="button"
              className="inline-flex h-8 items-center gap-2 rounded-xl px-3 text-[13px] font-medium text-muted transition hover:bg-ink-900/5 hover:text-ink-700"
              title={tab.title}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M5 5h14M5 12h10M5 19h7" />
              </svg>
              <span className="max-w-[160px] truncate">{tab.title}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={handleCreateBrowserTab}
            disabled={hasBrowserTab}
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-muted transition hover:bg-ink-900/5 hover:text-ink-700"
            title={hasBrowserTab ? "一个工作台暂时只支持一个浏览器标签" : "新建浏览器标签"}
            aria-label="新建工作台标签"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
        <div className="shrink-0 text-[11px] font-medium tracking-[0.16em] text-muted">WORKBENCH</div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-b border-black/8 bg-white/72 shadow-[0_24px_70px_rgba(30,38,52,0.08)] backdrop-blur-xl">
        <form
          onSubmit={handleSubmit}
          className="grid h-12 shrink-0 grid-cols-[auto_minmax(220px,720px)_auto] items-center gap-3 border-b border-black/8 bg-white/92 px-4"
        >
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
            <input value={url} onChange={(event) => setUrl(event.target.value)} className="min-w-0 flex-1 bg-transparent text-[12px] text-ink-700 outline-none placeholder:text-muted" placeholder="输入本地或线上页面地址" />
          </div>
          <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={handleCapture} className="inline-flex h-7 items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 text-[11px] font-medium text-ink-700 transition hover:bg-ink-900/5" title="截图">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 8a2 2 0 0 1 2-2h2l1.4-1.8A2 2 0 0 1 11 3.5h2a2 2 0 0 1 1.6.7L16 6h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z" /><circle cx="12" cy="12.5" r="3" /></svg>
            截图
          </button>
          <button type="button" onClick={handleToggleAnnotation} className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-[11px] font-medium transition ${state.annotationMode ? "border-accent/30 bg-accent-subtle text-accent" : "border-black/10 bg-white text-ink-700 hover:bg-ink-900/5"}`}>
            标注{annotations.length ? ` ${annotations.length}` : ""}
          </button>
          </div>
        </form>

        <div className="min-h-0 flex-1 bg-[linear-gradient(180deg,rgba(244,247,251,0.8),rgba(235,240,247,0.84))]">
          <div className="relative h-full min-h-0">
            <div ref={surfaceRef} className="absolute inset-0" />
            {!hasBrowserTab ? (
              <div className="grid h-full place-items-center p-6">
                <div className="w-full max-w-sm rounded-[18px] border border-dashed border-black/14 bg-white/72 px-5 py-7 text-center shadow-[0_16px_45px_rgba(30,38,52,0.08)]">
                  <div className="text-sm font-semibold text-ink-800">没有打开的浏览器标签</div>
                  <p className="mt-2 text-xs leading-5 text-muted">点击顶部 + 新建一个浏览器。</p>
                </div>
              </div>
            ) : !hasBrowserRuntime ? (
              <div className="grid h-full place-items-center p-6">
                <div className="w-full max-w-xl rounded-[14px] border border-dashed border-black/14 bg-white/78 px-6 py-8 text-center shadow-[0_16px_45px_rgba(30,38,52,0.08)]">
                  <div className="text-base font-semibold text-ink-800">需要重启 Electron</div>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
                    浏览器工作台依赖新的主进程和 preload IPC。当前窗口还在旧进程里，重启桌面端后就能加载真实网页。
                  </p>
                </div>
              </div>
            ) : isPreviewRuntime && state.url ? (
              <div className="grid h-full place-items-center p-6">
                <div className="w-full max-w-xl rounded-[14px] border border-dashed border-black/14 bg-white/78 px-6 py-8 text-center shadow-[0_16px_45px_rgba(30,38,52,0.08)]">
                  <div className="text-base font-semibold text-ink-800">当前是 Codex 网页预览态</div>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
                    已收到地址：{state.url}。真实网页承载依赖 Electron BrowserView，必须在桌面 Electron 窗口里打开；Codex 内置浏览器这里只能预览工作台 UI。
                  </p>
                </div>
              </div>
            ) : !state.url && (
              <div className="grid h-full place-items-center p-6">
                <div className="w-full max-w-xl rounded-[14px] border border-dashed border-black/14 bg-white/72 px-6 py-8 text-center shadow-[0_16px_45px_rgba(30,38,52,0.08)]">
                  <div className="text-base font-semibold text-ink-800">浏览器工作台</div>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">输入本地或线上页面地址后，会在这里加载真实 Electron 浏览器。</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
