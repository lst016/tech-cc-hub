import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEV_BROWSER_PREVIEW_FLAG, getDevElectronRuntimeSource } from "../dev-electron-shim";
import { ADD_PROMPT_ATTACHMENT_EVENT, PROMPT_FOCUS_EVENT, type AddPromptAttachmentDetail } from "../events";
import { useAppStore } from "../store/useAppStore";
import { hasRenderableBrowserWorkbenchBounds, shouldAttachBrowserWorkbench } from "../utils/browser-workbench-visibility";
import { normalizeWorkbenchUrl } from "../utils/workbench-url";
import { ActivityWorkspaceTabs } from "./ActivityWorkspaceTabs";
import type { ActivityWorkspaceTab } from "../utils/activity-workspace-tabs";
import { BrowserRecordingWorkbenchPanel } from "./browser-workbench/BrowserRecordingWorkbenchPanel";

type BrowserWorkbenchPageProps = {
  active?: boolean;
  initialUrl?: string;
  occluded?: boolean;
  sessionId?: string | null;
  onOpenTrace?: () => void;
  onOpenUsage?: () => void;
  onOpenPreview?: () => void;
  onOpenGit?: () => void;
  hasTerminalTab?: boolean;
  onOpenTerminal?: () => void;
  onCloseTerminal?: () => void;
};

type AnnotationTool = "screenshot" | "page";

function defaultRecordingArtifactPath(recordingPackage: BrowserWorkbenchRecordingPackage | null): string | null {
  return recordingPackage?.generatedSpecPath ??
    recordingPackage?.artifacts.find((artifact) => artifact.kind === "spec")?.path ??
    recordingPackage?.artifacts[0]?.path ??
    null;
}

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
  current?: boolean;
  recent?: boolean;
};

const RECENT_LOCAL_BROWSER_TARGETS_KEY = "tech-cc-hub:browser-workbench:recent-local-targets";
const COMMON_LOCAL_BROWSER_PORTS = [3000, 4173, 5173, 8000, 8001, 8080];
const MAX_LOCAL_BROWSER_TARGETS = 5;
const MAX_RECENT_LOCAL_BROWSER_TARGETS = 5;

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

function isLoopbackHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]";
}

function formatLocalBrowserTargetTitle(url: URL) {
  return url.host || url.hostname || url.href;
}

function getBrowserTargetOrigin(value: string) {
  const normalized = normalizeWorkbenchUrl(value) ?? value.trim();
  if (!normalized || typeof window === "undefined") return "";
  try {
    const url = new URL(normalized, window.location.href);
    return url.origin;
  } catch {
    return normalized;
  }
}

function getWorkspaceRecentStorageKey(workspaceKey: string) {
  return `${RECENT_LOCAL_BROWSER_TARGETS_KEY}:${encodeURIComponent(workspaceKey || "__global__")}`;
}

function estimateDataUrlBytes(dataUrl: string): number | undefined {
  const base64 = dataUrl.split(",", 2)[1];
  if (!base64) return undefined;
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor(base64.length * 0.75) - padding);
}

function mimeTypeFromDataUrl(dataUrl: string): string {
  const match = dataUrl.match(/^data:([^;,]+)[;,]/);
  return match?.[1] || "image/png";
}

function browserScreenshotAttachmentName(): string {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("");
  return `browser-screenshot-${stamp}.png`;
}

function readAccessibleStyles(documentRef: Document): string {
  return Array.from(documentRef.styleSheets)
    .map((sheet) => {
      try {
        return Array.from(sheet.cssRules).map((rule) => rule.cssText).join("\n");
      } catch {
        return "";
      }
    })
    .filter(Boolean)
    .join("\n");
}

async function capturePreviewFrameVisible(frame: HTMLIFrameElement): Promise<string | null> {
  const documentRef = frame.contentDocument;
  const sourceHtml = documentRef?.documentElement;
  if (!documentRef || !sourceHtml) return null;

  const width = Math.max(1, Math.round(frame.clientWidth || documentRef.documentElement.clientWidth || window.innerWidth));
  const height = Math.max(1, Math.round(frame.clientHeight || documentRef.documentElement.clientHeight || window.innerHeight));
  const clone = sourceHtml.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("script").forEach((script) => script.remove());

  const head = clone.querySelector("head") || clone.insertBefore(documentRef.createElement("head"), clone.firstChild);
  const base = documentRef.createElement("base");
  base.href = documentRef.location.href;
  head.prepend(base);

  const style = documentRef.createElement("style");
  const scrollX = documentRef.defaultView?.scrollX ?? 0;
  const scrollY = documentRef.defaultView?.scrollY ?? 0;
  style.textContent = `
    ${readAccessibleStyles(documentRef)}
    html, body { margin: 0 !important; width: ${width}px !important; min-height: ${height}px !important; overflow: hidden !important; }
    body { transform: translate(${-scrollX}px, ${-scrollY}px); transform-origin: 0 0; }
  `;
  head.append(style);

  const serialized = new XMLSerializer().serializeToString(clone);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <foreignObject width="100%" height="100%">${serialized}</foreignObject>
    </svg>
  `;
  const svgUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image();
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () => reject(new Error("preview screenshot render failed"));
      nextImage.src = svgUrl;
    });
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

function toBrowserPageTarget(value: string, options: { idPrefix?: string; current?: boolean; recent?: boolean; localOnly?: boolean } = {}): LocalBrowserTarget | null {
  const normalized = normalizeWorkbenchUrl(value) ?? value.trim();
  if (!normalized || typeof window === "undefined") return null;
  try {
    const url = new URL(normalized, window.location.href);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (options.localOnly && !isLoopbackHost(url.hostname)) return null;
    const targetUrl = url.href;
    const targetOrigin = getBrowserTargetOrigin(targetUrl);
    const host = url.host || url.hostname;
    return {
      id: `${options.idPrefix ?? "local"}-${encodeURIComponent(targetOrigin || targetUrl)}`,
      title: formatLocalBrowserTargetTitle(url),
      host,
      url: targetUrl,
      current: options.current,
      recent: options.recent,
    };
  } catch {
    return null;
  }
}

function readRecentLocalBrowserTargets(workspaceKey: string): LocalBrowserTarget[] {
  if (typeof window === "undefined") return [];
  try {
    const storageKey = getWorkspaceRecentStorageKey(workspaceKey);
    const raw = window.localStorage.getItem(storageKey);
    const values = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(values)) return [];
    const targets = values
      .filter((value): value is string => typeof value === "string")
      .map((value) => toBrowserPageTarget(value, { idPrefix: "recent", recent: true }))
      .filter((target): target is LocalBrowserTarget => Boolean(target));
    const normalizedUrls: string[] = [];
    const seenOrigins = new Set<string>();
    for (const target of targets) {
      const origin = getBrowserTargetOrigin(target.url);
      if (!origin || seenOrigins.has(origin)) continue;
      seenOrigins.add(origin);
      normalizedUrls.push(target.url);
      if (normalizedUrls.length >= MAX_RECENT_LOCAL_BROWSER_TARGETS) break;
    }
    if (JSON.stringify(values) !== JSON.stringify(normalizedUrls)) {
      window.localStorage.setItem(storageKey, JSON.stringify(normalizedUrls));
    }
    return normalizedUrls
      .map((value) => toBrowserPageTarget(value, { idPrefix: "recent", recent: true }))
      .filter((target): target is LocalBrowserTarget => Boolean(target));
  } catch {
    return [];
  }
}

function rememberRecentLocalBrowserTarget(workspaceKey: string, value: string) {
  const target = toBrowserPageTarget(value, { idPrefix: "recent", recent: true });
  if (!target || typeof window === "undefined") return false;
  try {
    const targetOrigin = getBrowserTargetOrigin(target.url);
    const current = readRecentLocalBrowserTargets(workspaceKey).map((item) => item.url);
    const existing = current.filter((url) => getBrowserTargetOrigin(url) !== targetOrigin);
    const next = [target.url, ...existing].slice(0, MAX_RECENT_LOCAL_BROWSER_TARGETS);
    if (JSON.stringify(current) === JSON.stringify(next)) return false;
    window.localStorage.setItem(getWorkspaceRecentStorageKey(workspaceKey), JSON.stringify(next));
    return true;
  } catch {
    // localStorage may be disabled in some embedded/runtime contexts.
    return false;
  }
}

function buildLocalBrowserTargets(workspaceKey: string): LocalBrowserTarget[] {
  const targets = new Map<string, LocalBrowserTarget>();
  const addTarget = (target: LocalBrowserTarget | null) => {
    if (!target) return;
    const key = getBrowserTargetOrigin(target.url) || target.url;
    if (!targets.has(key)) targets.set(key, target);
  };

  if (typeof window !== "undefined") {
    addTarget(toBrowserPageTarget(window.location.href, { idPrefix: "current", current: true, localOnly: true }));
  }

  for (const target of readRecentLocalBrowserTargets(workspaceKey)) {
    addTarget(target);
  }

  for (const port of COMMON_LOCAL_BROWSER_PORTS) {
    addTarget(toBrowserPageTarget(`http://localhost:${port}/`, { idPrefix: "default", localOnly: true }));
  }

  return Array.from(targets.values()).slice(0, MAX_LOCAL_BROWSER_TARGETS);
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

function toComparableWorkbenchUrl(value: string) {
  const normalized = normalizeWorkbenchUrl(value) ?? value.trim();
  if (!normalized) return null;
  if (typeof window === "undefined") return normalized;
  try {
    return new URL(normalized, window.location.href).href;
  } catch {
    return normalized;
  }
}

function isSameWorkbenchUrl(left: string | null, right: string | null) {
  return Boolean(left && right && left === right);
}

type PendingNavigation = {
  targetUrl: string | null;
  staleUrl: string | null;
};

export function BrowserWorkbenchPage({
  active = true,
  initialUrl = "",
  occluded = false,
  sessionId = null,
  onOpenTrace,
  onOpenUsage,
  onOpenPreview,
  onOpenGit,
  hasTerminalTab = false,
  onOpenTerminal,
  onCloseTerminal,
}: BrowserWorkbenchPageProps) {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const previewFrameRef = useRef<HTMLIFrameElement | null>(null);
  const hasOpenedRef = useRef(false);
  const isEditingUrlRef = useRef(false);
  const internalUrlUpdateRef = useRef<string | null>(null);
  const pendingNavigationRef = useRef<PendingNavigation | null>(null);
  const initialUrlRef = useRef(initialUrl);
  const sessionIdRef = useRef(sessionId);
  const sessionBrowserState = useAppStore((store) => (sessionId ? store.browserWorkbenchBySessionId[sessionId] : undefined));
  const workspaceKey = useAppStore((store) => {
    const session = sessionId ? (store.sessions[sessionId] ?? store.archivedSessions[sessionId]) : undefined;
    return session?.cwd?.trim() || store.cwd.trim() || sessionId || "__global__";
  });
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
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const canUseBrowserView = hasBrowserRuntime && !isPreviewRuntime;
  const [isDevToolsOpen, setIsDevToolsOpen] = useState(false);
  const [annotationTool, setAnnotationTool] = useState<AnnotationTool | null>(null);
  const [recordingState, setRecordingState] = useState<BrowserWorkbenchRecordingStatus>({ recording: false, actionCount: 0 });
  const [recordingPackage, setRecordingPackage] = useState<BrowserWorkbenchRecordingPackage | null>(null);
  const [selectedRecordingArtifactPath, setSelectedRecordingArtifactPath] = useState<string | null>(null);
  const [recordingSavedRootPath, setRecordingSavedRootPath] = useState<string | null>(null);
  const [recordingSaveError, setRecordingSaveError] = useState<string | null>(null);
  const [recordingRunResult, setRecordingRunResult] = useState<BrowserWorkbenchRecordingRunResult | null>(null);
  const [recordingRunEvents, setRecordingRunEvents] = useState<BrowserWorkbenchRecordingRunEvent[]>([]);
  const [recordingRunRunning, setRecordingRunRunning] = useState(false);
  const [recordingHistory, setRecordingHistory] = useState<BrowserWorkbenchRecordingHistoryItem[]>([]);
  const [recordingArtifactDraftContent, setRecordingArtifactDraftContent] = useState("");
  const [recordingArtifactDirty, setRecordingArtifactDirty] = useState(false);
  const [recordingArtifactSaving, setRecordingArtifactSaving] = useState(false);
  const showBrowserChrome = hasBrowserTab || active;
  const currentBrowserUrl = state.url || url;
  const hasCurrentUrl = Boolean(currentBrowserUrl.trim());
  const hasExternalBrowserUrl = hasCurrentUrl;
  const browserActive = shouldAttachBrowserWorkbench({ active, hasBrowserTab: hasBrowserTab && hasExternalBrowserUrl, occluded });
  const showLocalLauncher = showBrowserChrome && !hasExternalBrowserUrl;
  const previewUrl = isPreviewRuntime ? (state.url || url) : "";
  const canUsePageAnnotation = canUseBrowserView && hasExternalBrowserUrl;
  const canUseRecording = canUseBrowserView && hasExternalBrowserUrl;
  const [localTargets, setLocalTargets] = useState<LocalBrowserTarget[]>(() => buildLocalBrowserTargets(workspaceKey));
  const showRecordingWorkbench = recordingState.recording || Boolean(recordingPackage);
  const selectedRecordingArtifact = useMemo(() => {
    const artifacts = recordingPackage?.artifacts ?? [];
    if (!artifacts.length) return null;
    return artifacts.find((artifact) => artifact.path === selectedRecordingArtifactPath) ??
      artifacts.find((artifact) => artifact.kind === "spec") ??
      artifacts[0];
  }, [recordingPackage, selectedRecordingArtifactPath]);

  useEffect(() => {
    setRecordingArtifactDraftContent(selectedRecordingArtifact?.content ?? "");
    setRecordingArtifactDirty(false);
  }, [selectedRecordingArtifact?.path, selectedRecordingArtifact?.content]);

  const setUrlEditing = useCallback((nextEditing: boolean) => {
    isEditingUrlRef.current = nextEditing;
    setIsEditingUrl(nextEditing);
  }, []);

  const persistUrl = useCallback((nextUrl: string) => {
    if (!sessionId) return;
    internalUrlUpdateRef.current = toComparableWorkbenchUrl(nextUrl);
    setSessionBrowserUrl(sessionId, nextUrl);
  }, [sessionId, setSessionBrowserUrl]);

  const persistAnnotations = useCallback((nextAnnotations: BrowserWorkbenchAnnotation[]) => {
    if (sessionId) setSessionBrowserAnnotations(sessionId, nextAnnotations);
  }, [sessionId, setSessionBrowserAnnotations]);

  const rememberLocalTarget = useCallback((targetUrl: string) => {
    if (rememberRecentLocalBrowserTarget(workspaceKey, targetUrl)) {
      setLocalTargets(buildLocalBrowserTargets(workspaceKey));
    }
  }, [workspaceKey]);

  const syncBounds = useCallback(() => {
    if (!canUseBrowserView) return;
    if (!browserActive) {
      hasOpenedRef.current = false;
      void window.electron.setBrowserWorkbenchBounds({ x: 0, y: 0, width: 0, height: 0 }, sessionId ?? undefined);
      return;
    }
    const element = surfaceRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    if (!hasRenderableBrowserWorkbenchBounds(rect)) return;
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
    const targetComparableUrl = toComparableWorkbenchUrl(targetUrl);
    setUrlEditing(false);
    if (!targetUrl) {
      pendingNavigationRef.current = null;
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
      pendingNavigationRef.current = null;
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
    const staleComparableUrl = toComparableWorkbenchUrl(state.url);
    pendingNavigationRef.current = {
      targetUrl: targetComparableUrl,
      staleUrl: staleComparableUrl && !isSameWorkbenchUrl(staleComparableUrl, targetComparableUrl) ? staleComparableUrl : null,
    };
    setUrl(targetUrl);
    persistUrl(targetUrl);
    const nextState = await window.electron.openBrowserWorkbench(targetUrl, sessionId ?? undefined);
    const returnedComparableUrl = toComparableWorkbenchUrl(nextState.url);
    const openedTarget = isSameWorkbenchUrl(returnedComparableUrl, targetComparableUrl);
    const isStaleReturn = Boolean(pendingNavigationRef.current?.staleUrl && isSameWorkbenchUrl(returnedComparableUrl, pendingNavigationRef.current.staleUrl));
    if (returnedComparableUrl && !openedTarget && !isStaleReturn) {
      pendingNavigationRef.current = null;
    }
    setState(isStaleReturn ? { ...nextState, url: targetUrl, loading: true } : nextState);
    const returnedTargetUrl = returnedComparableUrl && !isStaleReturn ? nextState.url : targetUrl;
    if (openedTarget) {
      pendingNavigationRef.current = null;
    }
    setUrl(returnedTargetUrl);
    persistUrl(returnedTargetUrl);
    rememberLocalTarget(returnedTargetUrl);
    setStatusText("正在打开页面");
    setIsDevToolsOpen(false);
  }, [hasBrowserRuntime, isPreviewRuntime, persistUrl, rememberLocalTarget, sessionId, setSessionBrowserHasTab, setUrlEditing, state.url, syncBounds, url]);

  const autoOpenUrl = useCallback((nextUrl: string) => {
    if (hasOpenedRef.current) return;
    hasOpenedRef.current = true;
    void openUrl(nextUrl).catch((error) => {
      hasOpenedRef.current = false;
      console.warn("Failed to auto-open browser workbench:", error);
      setStatusText(`页面自动打开失败：${error instanceof Error ? error.message : String(error)}`);
    });
  }, [openUrl]);

  useEffect(() => {
    const sessionChanged = sessionIdRef.current !== sessionId;
    sessionIdRef.current = sessionId;
    setAnnotations(sessionBrowserState?.annotations ?? []);
    setHasBrowserTab(sessionBrowserState?.hasBrowserTab ?? Boolean(sessionBrowserState?.url || initialUrl));
    if (sessionChanged) {
      const nextUrl = normalizeWorkbenchUrl(sessionBrowserState?.url || initialUrl) ?? sessionBrowserState?.url ?? initialUrl;
      setState(defaultBrowserState);
      setUrlEditing(false);
      setUrl(nextUrl);
      hasOpenedRef.current = false;
      setAnnotationTool(null);
      setRecordingPackage(null);
      setSelectedRecordingArtifactPath(null);
      setRecordingSavedRootPath(null);
      setRecordingSaveError(null);
      setRecordingRunResult(null);
      setRecordingRunEvents([]);
      setRecordingRunRunning(false);
      setRecordingArtifactDraftContent("");
      setRecordingArtifactDirty(false);
    }
  }, [initialUrl, sessionBrowserState?.annotations, sessionBrowserState?.hasBrowserTab, sessionBrowserState?.url, sessionId, setUrlEditing]);

  useEffect(() => {
    if (initialUrlRef.current === initialUrl) return;
    initialUrlRef.current = initialUrl;
    const nextUrl = normalizeWorkbenchUrl(initialUrl) ?? initialUrl;
    const nextComparableUrl = toComparableWorkbenchUrl(nextUrl);
    if (internalUrlUpdateRef.current) {
      if (isSameWorkbenchUrl(nextComparableUrl, internalUrlUpdateRef.current)) {
        internalUrlUpdateRef.current = null;
        return;
      }
      internalUrlUpdateRef.current = null;
    }
    const pendingNavigation = pendingNavigationRef.current;
    if (isEditingUrlRef.current || (pendingNavigation?.staleUrl && isSameWorkbenchUrl(nextComparableUrl, pendingNavigation.staleUrl))) {
      return;
    }
    setUrlEditing(false);
    setUrl(nextUrl);
    persistUrl(nextUrl);
    if (active && hasBrowserTab && nextUrl) {
      hasOpenedRef.current = false;
      autoOpenUrl(nextUrl);
    }
  }, [active, autoOpenUrl, hasBrowserTab, initialUrl, persistUrl, setUrlEditing]);

  useEffect(() => {
    const unsubscribe = window.electron.onBrowserWorkbenchEvent((event) => {
      if (event.sessionId && sessionId && event.sessionId !== sessionId) return;
      if (event.type === "browser.state") {
        const pendingNavigation = pendingNavigationRef.current;
        const payloadUrl = toComparableWorkbenchUrl(event.payload.url);
        const isPendingTarget = isSameWorkbenchUrl(payloadUrl, pendingNavigation?.targetUrl ?? null);
        const isStaleUrl = Boolean(pendingNavigation?.staleUrl && isSameWorkbenchUrl(payloadUrl, pendingNavigation.staleUrl));
        if (pendingNavigation && payloadUrl && !isStaleUrl) {
          pendingNavigationRef.current = null;
        }
        setState(isStaleUrl ? { ...event.payload, url: pendingNavigation?.targetUrl ?? event.payload.url } : event.payload);
        if (!event.payload.annotationMode) {
          setAnnotationTool(null);
        }
        if (event.payload.url) {
          if (isPendingTarget) {
            pendingNavigationRef.current = null;
          }
          if (!isEditingUrlRef.current && !isStaleUrl) {
            setUrl(event.payload.url);
            persistUrl(event.payload.url);
            rememberLocalTarget(event.payload.url);
          }
        }
        return;
      }
      if (event.type === "browser.console") return;
      if (event.type === "browser.recording") {
        setRecordingState(event.payload);
        return;
      }
      if (event.type === "browser.recording.run") {
        setRecordingRunEvents((current) => [...current.slice(-199), event.payload]);
        return;
      }
      if (event.type === "browser.recording.package") {
        if (event.payload.recordingPackage) {
          setRecordingPackage(event.payload.recordingPackage);
          setRecordingSavedRootPath(event.payload.savedRootPath ?? null);
          setRecordingSaveError(event.payload.saveError ?? null);
          setRecordingRunResult(null);
          setSelectedRecordingArtifactPath((current) => current ?? defaultRecordingArtifactPath(event.payload.recordingPackage ?? null));
          setStatusText(event.payload.success ? "录制包已更新" : (event.payload.error || "录制包更新失败"));
        }
        return;
      }
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
  }, [persistAnnotations, persistUrl, rememberLocalTarget, sessionId]);

  useEffect(() => {
    if (!hasBrowserRuntime || isPreviewRuntime) return;
    void window.electron.getBrowserWorkbenchRecordingState(sessionId ?? undefined)
      .then(setRecordingState)
      .catch(() => setRecordingState({ recording: false, actionCount: 0 }));
    void window.electron.listBrowserWorkbenchRecordings(sessionId ?? undefined, 20)
      .then(setRecordingHistory)
      .catch(() => setRecordingHistory([]));
  }, [hasBrowserRuntime, isPreviewRuntime, sessionId]);

  useEffect(() => {
    const element = surfaceRef.current;
    if (!element) return;

    const observer = new ResizeObserver(() => {
      syncBounds();
      if (!isEditingUrl && browserActive && !hasOpenedRef.current && (url || initialUrl)) {
        autoOpenUrl(url || initialUrl);
      }
    });

    observer.observe(element);
    window.addEventListener("resize", syncBounds);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncBounds);
    };
  }, [autoOpenUrl, browserActive, initialUrl, isEditingUrl, syncBounds, url]);

  useEffect(() => {
    if (!hasBrowserRuntime) return;
    if (isPreviewRuntime) {
      if (!isEditingUrl && browserActive && !hasOpenedRef.current && (url || initialUrl)) {
        autoOpenUrl(url || initialUrl);
      }
      return;
    }
    if (!browserActive) {
      void window.electron.setBrowserWorkbenchBounds({ x: 0, y: 0, width: 0, height: 0 }, sessionId ?? undefined);
      return;
    }
    syncBounds();
    if (!isEditingUrl && !hasOpenedRef.current && (url || initialUrl)) {
      autoOpenUrl(url || initialUrl);
    }
  }, [autoOpenUrl, browserActive, hasBrowserRuntime, initialUrl, isEditingUrl, isPreviewRuntime, sessionId, syncBounds, url]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void openUrl(url);
  };

  const handleReload = async () => {
    const typedUrl = toComparableWorkbenchUrl(url);
    const loadedUrl = toComparableWorkbenchUrl(state.url);
    if (typedUrl && typedUrl !== loadedUrl) {
      await openUrl(url);
      return;
    }
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
    const result = await window.electron.captureBrowserWorkbenchVisible(sessionId ?? undefined);
    let dataUrl = result.success ? result.dataUrl : undefined;
    if (!dataUrl && isPreviewRuntime && previewFrameRef.current) {
      try {
        dataUrl = await capturePreviewFrameVisible(previewFrameRef.current) ?? undefined;
      } catch {
        dataUrl = undefined;
      }
    }
    if (dataUrl) {
      const detail: AddPromptAttachmentDetail = {
        kind: "image",
        name: browserScreenshotAttachmentName(),
        mimeType: mimeTypeFromDataUrl(dataUrl),
        data: dataUrl,
        preview: dataUrl,
        size: estimateDataUrlBytes(dataUrl),
      };
      window.dispatchEvent(new CustomEvent<AddPromptAttachmentDetail>(ADD_PROMPT_ATTACHMENT_EVENT, { detail }));
      window.dispatchEvent(new CustomEvent(PROMPT_FOCUS_EVENT));
      setStatusText("截图已加入输入框");
      return;
    }
    setStatusText(result.error || "截图失败；预览态只能截取同源页面");
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

  const handleToggleRecording = async () => {
    if (!hasBrowserRuntime) {
      setStatusText("当前 Electron 主进程还没有录制能力，请重启应用后再试");
      return;
    }
    if (isPreviewRuntime) {
      setStatusText("预览态不能录制 Electron BrowserView");
      return;
    }
    if (!hasExternalBrowserUrl) {
      setStatusText("先打开一个页面再录制");
      return;
    }

    if (recordingState.recording) {
      const result = await window.electron.stopBrowserWorkbenchRecording(sessionId ?? undefined);
      const nextPackage = result.recordingPackage ?? null;
      setRecordingState({
        recording: false,
        id: result.id,
        startedAt: result.startedAt,
        url: result.url,
        title: result.title,
        actionCount: result.actionCount,
      });
      setRecordingPackage(nextPackage);
      setRecordingSavedRootPath(result.savedRootPath ?? null);
      setRecordingSaveError(result.saveError ?? null);
      setRecordingRunResult(null);
      setRecordingRunEvents([]);
      if (result.savedRootPath) {
        void window.electron.listBrowserWorkbenchRecordings(sessionId ?? undefined, 20)
          .then(setRecordingHistory)
          .catch(() => undefined);
      }
      setSelectedRecordingArtifactPath(
        defaultRecordingArtifactPath(nextPackage),
      );
      if (!result.success || !result.script) {
        setStatusText(result.error || "停止录制失败");
        return;
      }
      try {
        await navigator.clipboard.writeText(result.script);
        const savedText = result.savedRootPath ? `，已保存到 ${result.savedRootPath}` : result.saveError ? `，保存失败：${result.saveError}` : "";
        setStatusText(`已生成录制包：${result.actionCount} 步，已复制基础 Playwright 脚本${savedText}`);
      } catch {
        const savedText = result.savedRootPath ? `，已保存到 ${result.savedRootPath}` : result.saveError ? `，保存失败：${result.saveError}` : "";
        setStatusText(`已生成录制包：${result.actionCount} 步，剪贴板写入失败${savedText}`);
      }
      return;
    }

    const result = await window.electron.startBrowserWorkbenchRecording(sessionId ?? undefined);
    if (result.success) {
      setRecordingPackage(null);
      setSelectedRecordingArtifactPath(null);
      setRecordingSavedRootPath(null);
      setRecordingSaveError(null);
      setRecordingRunResult(null);
      setRecordingRunEvents([]);
      setRecordingRunRunning(false);
      setRecordingArtifactDraftContent("");
      setRecordingArtifactDirty(false);
    }
    setRecordingState({
      recording: result.recording,
      id: result.id,
      startedAt: result.startedAt,
      url: result.url,
      title: result.title,
      actionCount: result.actionCount,
    });
    setStatusText(result.success ? "录制已开始" : (result.error || "录制启动失败"));
  };

  const handleToggleRecordingAssertionMode = async () => {
    if (!hasBrowserRuntime) {
      setStatusText("当前 Electron 主进程还没有录制断言能力，请重启应用后再试");
      return;
    }
    if (!recordingState.recording) {
      setStatusText("录制开始后才能切换断言模式");
      return;
    }
    const nextStatus = await window.electron.setBrowserWorkbenchRecordingAssertionMode(
      !recordingState.assertionMode,
      sessionId ?? undefined,
    );
    setRecordingState(nextStatus);
    setStatusText(nextStatus.assertionMode ? "断言模式已开启，点击页面元素生成可见性断言" : "断言模式已关闭");
  };

  const handleRunRecording = async () => {
    if (!hasBrowserRuntime) {
      setStatusText("当前 Electron 主进程还没有录制运行器能力，请重启应用后再试");
      return;
    }
    if (isPreviewRuntime) {
      setStatusText("预览态不能运行 Electron Playwright 录制包");
      return;
    }
    if (!recordingPackage) {
      setStatusText("先完成一次录制再运行测试");
      return;
    }
    if (recordingRunRunning) return;
    setRecordingRunRunning(true);
    setRecordingRunEvents([]);
    setStatusText("正在运行生成的 Playwright 测试");
    try {
      const result = await window.electron.runBrowserWorkbenchRecording(sessionId ?? undefined);
      setRecordingRunResult(result);
      setRecordingRunEvents(result.events);
      if (result.success) {
        setStatusText(`Playwright 测试通过：${result.durationMs}ms`);
      } else {
        setStatusText(`Playwright 测试未通过：${result.error || result.status}`);
      }
    } catch (error) {
      setStatusText(`Playwright 运行失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setRecordingRunRunning(false);
    }
  };

  const handleOpenRecordingRunOutput = async () => {
    const result = await window.electron.openBrowserWorkbenchRecordingRunOutput(sessionId ?? undefined);
    setStatusText(result.success ? "已打开 Playwright 输出目录" : (result.error || "打开输出目录失败"));
  };

  const handleOpenRecordingTraceViewer = async () => {
    const result = await window.electron.openBrowserWorkbenchRecordingTraceViewer(sessionId ?? undefined);
    setStatusText(result.success ? "已打开 Playwright Trace Viewer" : (result.error || "打开 Trace 失败"));
  };

  const handleCancelRecordingRun = async () => {
    const result = await window.electron.cancelBrowserWorkbenchRecordingRun(sessionId ?? undefined);
    setStatusText(result.success ? "已请求取消 Playwright 运行" : (result.error || "取消运行失败"));
  };

  const handleRefreshRecordingHistory = async () => {
    const history = await window.electron.listBrowserWorkbenchRecordings(sessionId ?? undefined, 20);
    setRecordingHistory(history);
    setStatusText(`已刷新历史录制：${history.length} 个`);
  };

  const handleLoadRecordingHistory = async (rootPath: string) => {
    const result = await window.electron.loadBrowserWorkbenchRecording(rootPath, sessionId ?? undefined);
    if (!result.success || !result.recordingPackage) {
      setStatusText(result.error || "加载历史录制失败");
      return;
    }
    setRecordingPackage(result.recordingPackage);
    setRecordingSavedRootPath(result.savedRootPath ?? rootPath);
    setRecordingSaveError(result.saveError ?? null);
    setRecordingRunResult(null);
    setRecordingRunEvents([]);
    setSelectedRecordingArtifactPath(defaultRecordingArtifactPath(result.recordingPackage));
    setStatusText(`已加载历史录制：${result.actionCount} 步`);
  };

  const handleChangeRecordingArtifactDraft = (content: string) => {
    setRecordingArtifactDraftContent(content);
    setRecordingArtifactDirty(content !== (selectedRecordingArtifact?.content ?? ""));
  };

  const handleSaveRecordingArtifact = async () => {
    if (!selectedRecordingArtifact || !recordingPackage) return;
    setRecordingArtifactSaving(true);
    try {
      const result = await window.electron.updateBrowserWorkbenchRecordingArtifact(
        selectedRecordingArtifact.path,
        recordingArtifactDraftContent,
        sessionId ?? undefined,
      );
      if (!result.success) {
        setStatusText(result.error || "保存录制文件失败");
        return;
      }
      setRecordingPackage(result.recordingPackage);
      setRecordingArtifactDirty(false);
      setStatusText("录制文件已保存");
    } finally {
      setRecordingArtifactSaving(false);
    }
  };

  const handleStartRecordingLocatorPick = async (actionId: string) => {
    const status = await window.electron.startBrowserWorkbenchRecordingLocatorPick(actionId, sessionId ?? undefined);
    setRecordingState(status);
    setStatusText(status.locatorPickActionId ? "点选页面元素以修复 selector" : "无法启动 selector 点选");
  };

  const handleCancelRecordingLocatorPick = async () => {
    const status = await window.electron.cancelBrowserWorkbenchRecordingLocatorPick(sessionId ?? undefined);
    setRecordingState(status);
    setStatusText("已取消 selector 点选");
  };

  const handleAddRecordingAssertion = async (kind: BrowserWorkbenchRecordedAction["kind"], value?: string) => {
    if (!recordingState.recording) return;
    const result = await window.electron.addBrowserWorkbenchRecordingAssertion({ kind, value }, sessionId ?? undefined);
    if (!result.success) {
      setStatusText(result.error || "添加断言失败");
      return;
    }
    setRecordingState({
      recording: result.recording,
      id: result.id,
      startedAt: result.startedAt,
      url: result.url,
      title: result.title,
      actionCount: result.actionCount,
      assertionMode: recordingState.assertionMode,
    });
    setStatusText("断言已加入录制时间线");
  };

  const handleRepairRecordingLocator = async (actionId: string) => {
    const selector = window.prompt("输入新的稳定 selector，例如 [data-testid=\"submit\"]");
    if (!selector?.trim()) return;
    const result = await window.electron.repairBrowserWorkbenchRecordingLocator(actionId, selector, sessionId ?? undefined);
    if (!result.success || !result.recordingPackage) {
      setStatusText(result.error || "Locator 修复失败");
      return;
    }
    setRecordingPackage(result.recordingPackage);
    setRecordingSavedRootPath(result.savedRootPath ?? null);
    setRecordingSaveError(result.saveError ?? null);
    setRecordingRunResult(null);
    setRecordingRunEvents([]);
    setSelectedRecordingArtifactPath(
      defaultRecordingArtifactPath(result.recordingPackage),
    );
    setStatusText(result.saveError ? `Locator 已修复，但保存失败：${result.saveError}` : "Locator 已修复并重新生成录制包");
    void window.electron.listBrowserWorkbenchRecordings(sessionId ?? undefined, 20)
      .then(setRecordingHistory)
      .catch(() => undefined);
  };

  const handleScreenshotAnnotate = async () => {
    if (!hasBrowserRuntime) {
      setStatusText("当前 Electron 主进程还没有截图标注能力，请重启应用后再试");
      return;
    }
    if (isPreviewRuntime) {
      setStatusText("Codex 内置浏览器不能截图 Electron BrowserView");
      return;
    }
    if (state.annotationMode && annotationTool === "screenshot") {
      const nextState = await window.electron.setBrowserWorkbenchAnnotationMode(false, sessionId ?? undefined);
      setState(nextState);
      setAnnotationTool(null);
      setStatusText("截图标注模式已关闭");
      return;
    }
    const result = await window.electron.captureBrowserWorkbenchVisible(sessionId ?? undefined);
    if (result.success && result.dataUrl) {
      const nextState = await window.electron.setBrowserWorkbenchAnnotationMode(true, sessionId ?? undefined);
      setState(nextState);
      setAnnotationTool("screenshot");
      setStatusText("截图标注模式已开启，点击页面位置添加批注");
    } else {
      setStatusText(result.error || "截图标注失败");
    }
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
    const nextEnabled = !(state.annotationMode && annotationTool === "page");
    const nextState = await window.electron.setBrowserWorkbenchAnnotationMode(nextEnabled, sessionId ?? undefined);
    setState(nextState);
    setAnnotationTool(nextEnabled ? "page" : null);
    setStatusText(nextEnabled ? "标注模式已开启" : "标注模式已关闭");
  };

  const handleCloseBrowserTab = async () => {
    setHasBrowserTab(false);
    if (sessionId) setSessionBrowserHasTab(sessionId, false);
    hasOpenedRef.current = false;
    pendingNavigationRef.current = null;
    setState(defaultBrowserState);
    setUrlEditing(false);
    setUrl("");
    persistUrl("");
    setAnnotations([]);
    persistAnnotations([]);
    setIsDevToolsOpen(false);
    setAnnotationTool(null);
    setRecordingState({ recording: false, actionCount: 0 });
    setRecordingPackage(null);
    setSelectedRecordingArtifactPath(null);
    setRecordingSavedRootPath(null);
    setRecordingSaveError(null);
    setRecordingRunResult(null);
    setRecordingRunEvents([]);
    setRecordingRunRunning(false);
    setRecordingArtifactDraftContent("");
    setRecordingArtifactDirty(false);
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
    pendingNavigationRef.current = null;
    setState(defaultBrowserState);
    setUrlEditing(false);
    setUrl("");
    persistUrl("");
    setAnnotations([]);
    persistAnnotations([]);
    setIsDevToolsOpen(false);
    setAnnotationTool(null);
    setRecordingState({ recording: false, actionCount: 0 });
    setRecordingPackage(null);
    setSelectedRecordingArtifactPath(null);
    setRecordingSavedRootPath(null);
    setRecordingSaveError(null);
    setRecordingRunResult(null);
    setRecordingRunEvents([]);
    setRecordingRunRunning(false);
    setRecordingArtifactDraftContent("");
    setRecordingArtifactDirty(false);
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
    setUrlEditing(false);
    setUrl(browserTargetUrl);
    persistUrl(browserTargetUrl);
    rememberLocalTarget(browserTargetUrl);
    hasOpenedRef.current = false;
    setRecordingPackage(null);
    setSelectedRecordingArtifactPath(null);
    setRecordingSavedRootPath(null);
    setRecordingSaveError(null);
    setRecordingRunResult(null);
    setRecordingRunEvents([]);
    setRecordingRunRunning(false);
    setRecordingArtifactDraftContent("");
    setRecordingArtifactDirty(false);
    const staleComparableUrl = toComparableWorkbenchUrl(state.url);
    const targetComparableUrl = toComparableWorkbenchUrl(browserTargetUrl);
    pendingNavigationRef.current = {
      targetUrl: targetComparableUrl,
      staleUrl: staleComparableUrl && !isSameWorkbenchUrl(staleComparableUrl, targetComparableUrl) ? staleComparableUrl : null,
    };
    setStatusText("正在打开本地页面");
  }, [persistUrl, rememberLocalTarget, sessionId, setSessionBrowserHasTab, setUrlEditing, state.url]);
  const showBrowserSurface = showBrowserChrome;
  const handleSelectWorkspaceTab = (tab: ActivityWorkspaceTab) => {
    if (tab === "trace") {
      onOpenTrace?.();
      return;
    }
    if (tab === "usage") {
      onOpenUsage?.();
      return;
    }
    if (tab === "preview") {
      onOpenPreview?.();
      return;
    }
    if (tab === "git") {
      onOpenGit?.();
      return;
    }
    if (tab === "terminal") {
      onOpenTerminal?.();
    }
  };

  useEffect(() => {
    setLocalTargets(buildLocalBrowserTargets(workspaceKey));
  }, [workspaceKey]);

  useEffect(() => {
    let cancelled = false;
    setLocalTargetStatus(Object.fromEntries(localTargets.map((target) => [target.id, "checking" as const])));
    void Promise.all(
      localTargets.map(async (target) => {
        const status = await probeLocalTarget(target.url);
        if (cancelled) return;
        setLocalTargetStatus((current) => ({ ...current, [target.id]: status }));
      }),
    );
    return () => {
      cancelled = true;
    };
  }, [localTargets]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white/82">
      <div className="relative z-[160] flex h-10 shrink-0 items-center justify-between border-b border-black/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(250,251,253,0.92))] px-4 backdrop-blur-xl">
        <ActivityWorkspaceTabs
          activeTab="browser"
          showBrowserTab={showBrowserChrome}
          showTerminalTab={hasTerminalTab}
          browserLabel={state.title || "浏览器"}
          showCreateBrowserTab
          showCreateTerminalTab={!hasTerminalTab}
          onSelectTab={handleSelectWorkspaceTab}
          onCloseBrowserTab={hasBrowserTab ? () => { void handleCloseBrowserTab(); } : undefined}
          onCreateBrowserTab={() => { void handleCreateBrowserTab(); }}
          onCreateTerminalTab={onOpenTerminal}
          onCloseTerminalTab={hasTerminalTab ? onCloseTerminal : undefined}
        />
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
            <input
              value={url}
              onChange={(event) => {
                setUrlEditing(true);
                setUrl(event.target.value);
              }}
              spellCheck={false}
              className="min-w-0 flex-1 bg-transparent text-[12px] text-ink-700 outline-none placeholder:text-muted"
              placeholder="输入 URL"
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            {statusText && statusText !== "准备打开页面" && (
              <span className="hidden max-w-[180px] truncate rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium text-muted shadow-sm lg:inline">
                {statusText}
              </span>
            )}
            <button
              type="button"
              onClick={handleToggleRecording}
              disabled={!canUseRecording}
              className={`relative inline-flex h-8 w-8 items-center justify-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-50 ${recordingState.recording ? "border-red-300 bg-red-50 text-red-600" : "border-black/10 bg-white text-ink-700 hover:bg-ink-900/5"}`}
              title={recordingState.recording ? "停止录制并生成 Playwright 录制包" : "录制 Playwright 测试包"}
              aria-label={recordingState.recording ? "停止录制并生成 Playwright 录制包" : "录制 Playwright 测试包"}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <circle cx="12" cy="12" r="7" />
                <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
              </svg>
              {recordingState.recording && (
                <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[9px] font-bold leading-none text-white">
                  {Math.min(recordingState.actionCount, 99)}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={handleToggleRecordingAssertionMode}
              disabled={!canUseRecording || !recordingState.recording}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-50 ${recordingState.assertionMode ? "border-blue-300 bg-blue-50 text-blue-700" : "border-black/10 bg-white text-ink-700 hover:bg-ink-900/5"}`}
              title={recordingState.assertionMode ? "关闭断言模式" : "开启断言模式"}
              aria-label={recordingState.assertionMode ? "关闭断言模式" : "开启断言模式"}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M5 12.5 9.2 17 19 6.5" />
                <path d="M4 4h16v16H4z" />
              </svg>
            </button>
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
            <button
              type="button"
              onClick={handleScreenshotAnnotate}
              disabled={!canUsePageAnnotation}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-50 ${state.annotationMode && annotationTool === "screenshot" ? "border-accent/30 bg-accent-subtle text-accent" : "border-black/10 bg-white text-ink-700 hover:bg-ink-900/5"}`}
              title={state.annotationMode && annotationTool === "screenshot" ? "关闭截图标注" : "开启截图标注"}
              aria-label={state.annotationMode && annotationTool === "screenshot" ? "关闭截图标注" : "开启截图标注"}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M4 5h16a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
                <circle cx="8" cy="10" r="1.5" fill="currentColor" stroke="none" />
                <path d="M10 10h6" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
            <button
              type="button"
              onClick={handleToggleAnnotation}
              disabled={!canUsePageAnnotation}
              className={`relative inline-flex h-8 w-8 items-center justify-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-50 ${state.annotationMode && annotationTool === "page" ? "border-accent/30 bg-accent-subtle text-accent" : "border-black/10 bg-white text-ink-700 hover:bg-ink-900/5"}`}
              title={state.annotationMode && annotationTool === "page" ? "关闭标注" : "开启标注"}
              aria-label={state.annotationMode && annotationTool === "page" ? "关闭标注" : "开启标注"}
            >
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

        <div className={`min-h-0 flex-1 bg-white ${showRecordingWorkbench ? "grid grid-cols-[minmax(0,1fr)_380px]" : ""}`}>
          <div className="relative h-full min-h-0">
            <div
              ref={surfaceRef}
              className={`absolute inset-0 ${hasBrowserTab && hasExternalBrowserUrl ? "block" : "pointer-events-none invisible"}`}
            />
            {!hasBrowserTab ? (
              <div className="flex h-full justify-center overflow-y-auto px-6 py-2">
                <div className="w-full max-w-[620px]">
                  <div className="mb-2 text-[15px] font-medium text-muted">最近 / 本地</div>
                  <div className="grid gap-3">
                    {localTargets.slice(0, MAX_LOCAL_BROWSER_TARGETS).map((target) => {
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
                            <div className="mt-1 truncate text-[17px] text-muted">{target.url}</div>
                            {(target.current || target.recent) && (
                              <div className="mt-2 inline-flex rounded-md border border-black/8 bg-surface px-2 py-0.5 text-[11px] font-medium text-muted">
                                {target.current ? "当前" : "最近"}
                              </div>
                            )}
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
                ref={previewFrameRef}
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
                  <div className="mb-2 text-[15px] font-medium text-muted">最近 / 本地</div>
                  <div className="grid gap-3">
                    {localTargets.slice(0, MAX_LOCAL_BROWSER_TARGETS).map((target) => {
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
                            <div className="mt-1 truncate text-[17px] text-muted">{target.url}</div>
                            {(target.current || target.recent) && (
                              <div className="mt-2 inline-flex rounded-md border border-black/8 bg-surface px-2 py-0.5 text-[11px] font-medium text-muted">
                                {target.current ? "当前" : "最近"}
                              </div>
                            )}
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
          {showRecordingWorkbench && (
            <BrowserRecordingWorkbenchPanel
              recordingState={recordingState}
              recordingPackage={recordingPackage}
              savedRootPath={recordingSavedRootPath}
              saveError={recordingSaveError}
              runResult={recordingRunResult}
              runEvents={recordingRunEvents}
              runRunning={recordingRunRunning}
              historyItems={recordingHistory}
              selectedArtifactPath={selectedRecordingArtifactPath}
              artifactDraftContent={recordingArtifactDraftContent}
              artifactDirty={recordingArtifactDirty}
              artifactSaving={recordingArtifactSaving}
              onSelectArtifact={setSelectedRecordingArtifactPath}
              onChangeArtifactDraft={handleChangeRecordingArtifactDraft}
              onSaveArtifact={handleSaveRecordingArtifact}
              onRunRecording={handleRunRecording}
              onCancelRun={handleCancelRecordingRun}
              onOpenRunOutput={handleOpenRecordingRunOutput}
              onOpenTraceViewer={handleOpenRecordingTraceViewer}
              onRefreshHistory={handleRefreshRecordingHistory}
              onLoadHistory={handleLoadRecordingHistory}
              onStartLocatorPick={handleStartRecordingLocatorPick}
              onCancelLocatorPick={handleCancelRecordingLocatorPick}
              onRepairLocator={handleRepairRecordingLocator}
              onAddAssertion={handleAddRecordingAssertion}
            />
          )}
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
