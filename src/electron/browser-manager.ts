import { BrowserView, BrowserWindow, shell, type WebContents } from "electron";
import { getChromeCookes, isChromeInstalled } from "./libs/chrome-cookie-sync.js";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { buildBrowserWorkbenchWebPreferences } from "./libs/browser-workbench/browser-workbench-session.js";
import { getBrowserWorkbenchPreloadPath } from "./pathResolver.js";
import {
  sanitizeBrowserWorkbenchBounds,
  shouldDetachBrowserWorkbenchForBounds,
} from "./libs/browser-workbench/browser-workbench-bounds.js";
import {
  appendBrowserWorkbenchRecordedAction,
  buildBrowserWorkbenchRecorderInjectionScript,
  createBrowserWorkbenchRecordingSession,
  finalizeBrowserWorkbenchRecording,
  getBrowserWorkbenchRecordingStatus,
  listBrowserWorkbenchRecordingHistory,
  readBrowserWorkbenchRecordingPackage,
  runBrowserWorkbenchRecordingPackage,
  updateBrowserWorkbenchRecordingArtifact,
  writeBrowserWorkbenchRecordingPackage,
  type BrowserWorkbenchRecordingArtifactUpdateResult,
  type BrowserWorkbenchRecordingCancelRunResult,
  type BrowserWorkbenchRecordingHistoryItem,
  type BrowserWorkbenchRecordingOpenPathResult,
  type BrowserWorkbenchRecordingResult,
  type BrowserWorkbenchRecordingRunEvent,
  type BrowserWorkbenchRecordingRunResult,
  type BrowserWorkbenchRecordingSession,
  type BrowserWorkbenchRecordingStatus,
} from "./libs/browser-workbench/browser-workbench-recorder.js";

export type {
  BrowserWorkbenchRecordedAction,
  BrowserWorkbenchRecordingArtifact,
  BrowserWorkbenchRecordingArtifactUpdateResult,
  BrowserWorkbenchRecordingCancelRunResult,
  BrowserWorkbenchRecordingHistoryItem,
  BrowserWorkbenchRecordingOpenPathResult,
  BrowserWorkbenchRecordingPackage,
  BrowserWorkbenchRecordingResult,
  BrowserWorkbenchRecordingRunEvent,
  BrowserWorkbenchRecordingRunResult,
  BrowserWorkbenchRecordingStatus,
} from "./libs/browser-workbench/browser-workbench-recorder.js";

export type BrowserWorkbenchBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type BrowserWorkbenchManagerOptions = {
  resolveWorkspaceRoot?: () => string | undefined;
};

export type BrowserWorkbenchState = {
  url: string;
  title?: string;
  loading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  annotationMode: boolean;
};

export type BrowserWorkbenchConsoleLog = {
  level: "debug" | "info" | "log" | "warn" | "error";
  message: string;
  timestamp: number;
  url?: string;
  line?: number;
};

export type BrowserWorkbenchNetworkLog = {
  id: string;
  url: string;
  method?: string;
  resourceType?: string;
  status?: number;
  statusText?: string;
  mimeType?: string;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  requestPostData?: string;
  requestPostDataPreview?: string;
  requestPostDataTruncated?: boolean;
  responseBody?: string;
  responseBodyPreview?: string;
  responseBodyBase64Encoded?: boolean;
  responseBodyTruncated?: boolean;
  responseJsonFields?: Record<string, string | number | boolean | null>;
  bodyUnavailableReason?: string;
  errorText?: string;
  fromDiskCache?: boolean;
  fromServiceWorker?: boolean;
  startedAt: number;
  finishedAt?: number;
  durationMs?: number;
};

export type BrowserWorkbenchHttpRequestInput = {
  method?: string;
  url: string;
  body?: string;
  headers?: Record<string, string>;
  contentType?: string;
  timeoutMs?: number;
};

export type BrowserWorkbenchHttpRequestResult = {
  url: string;
  title?: string;
  requestUrl: string;
  method: string;
  status?: number;
  statusText?: string;
  ok?: boolean;
  redirected?: boolean;
  responseUrl?: string;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  responseBodyPreview?: string;
  responseBodyTruncated?: boolean;
  responseJsonFields?: Record<string, string | number | boolean | null>;
  contentType?: string;
  durationMs: number;
  error?: string;
};

export type BrowserWorkbenchNetworkLogInput = {
  limit?: number;
  includeBody?: boolean;
  includeHeaders?: boolean;
  urlContains?: string;
  resourceTypes?: string[];
};

export type BrowserWorkbenchNetworkLogResult = {
  url: string;
  title?: string;
  captureEnabled: boolean;
  captureError?: string;
  count: number;
  entries: BrowserWorkbenchNetworkLog[];
};

export type BrowserWorkbenchSourceCandidate = {
  component?: string;
  file?: string;
  line?: number;
  column?: number;
  framework?: "react" | "vue" | "class";
  source: "react-debug-source" | "vue-file" | "component-stack" | "class-name";
  confidence: "high" | "medium" | "low";
};

export type BrowserWorkbenchDomHint = {
  tagName: string;
  role?: string;
  text?: string;
  ariaLabel?: string;
  selector?: string;
  path?: string;
  xpath?: string;
  hitTagName?: string;
  hitPath?: string;
  hitXPath?: string;
  hitBoundingBox?: { x: number; y: number; width: number; height: number };
  target?: { type: "text"; value: string } | { type: "image"; url: string; alt?: string };
  selectorCandidates: string[];
  boundingBox?: { x: number; y: number; width: number; height: number };
  computedStyle?: Record<string, string>;
  componentStack?: string[];
  sourceCandidates?: BrowserWorkbenchSourceCandidate[];
  componentStackSource?: string;
  componentStackConfidence?: "high" | "medium" | "low";
  context?: {
    ancestorChain?: string[];
    nearbyText?: string;
  };
};

export type BrowserWorkbenchPageSnapshot = {
  url: string;
  title?: string;
  description?: string;
  canonicalUrl?: string;
  selectedText?: string;
  text: string;
  headings: Array<{ level: number; text: string }>;
  links: Array<{ text: string; href: string }>;
  images: Array<{ src: string; alt?: string }>;
};

export type BrowserWorkbenchQueryStrategy = "selector" | "xpath";

export type BrowserWorkbenchDomStats = {
  url: string;
  title?: string;
  totalElements: number;
  interactiveCounts: {
    links: number;
    buttons: number;
    inputs: number;
    selects: number;
    textareas: number;
    forms: number;
    images: number;
    scripts: number;
    stylesheets: number;
    iframes: number;
  };
  topTags: Array<{ tagName: string; count: number }>;
};

export type BrowserWorkbenchNodeSnapshot = {
  index: number;
  tagName: string;
  id?: string;
  className?: string;
  text?: string;
  selector?: string;
  path?: string;
  xpath?: string;
  htmlSnippet?: string;
  attributes: Record<string, string>;
  boundingBox?: { x: number; y: number; width: number; height: number };
  computedStyle?: Record<string, string>;
};

export type BrowserWorkbenchNodeQueryResult = {
  url: string;
  title?: string;
  strategy: BrowserWorkbenchQueryStrategy;
  query: string;
  total: number;
  returned: number;
  matches: BrowserWorkbenchNodeSnapshot[];
};

export type BrowserWorkbenchStyleInspection = {
  url: string;
  title?: string;
  strategy: BrowserWorkbenchQueryStrategy;
  query: string;
  index: number;
  found: boolean;
  node?: BrowserWorkbenchNodeSnapshot;
  inlineStyle?: string;
  computedStyle?: Record<string, string>;
  cssVariables?: Record<string, string>;
};

export type BrowserWorkbenchStyleApplyInput = {
  strategy?: BrowserWorkbenchQueryStrategy;
  query: string;
  index?: number;
  styles: Record<string, string | number>;
  persist?: boolean;
};

export type BrowserWorkbenchStyleApplyResult = {
  url: string;
  title?: string;
  strategy: BrowserWorkbenchQueryStrategy;
  query: string;
  index: number;
  found: boolean;
  applied: Record<string, string>;
  previousInlineStyle?: string;
  nextInlineStyle?: string;
  before?: Record<string, string>;
  after?: Record<string, string>;
  persist: boolean;
  node?: BrowserWorkbenchNodeSnapshot;
  error?: string;
};

export type BrowserWorkbenchInteractiveElement = {
  ref: string;
  tagName: string;
  role?: string;
  name?: string;
  type?: string;
  text?: string;
  value?: string;
  href?: string;
  selector?: string;
  xpath?: string;
  disabled: boolean;
  boundingBox?: { x: number; y: number; width: number; height: number };
};

export type BrowserWorkbenchInteractiveSnapshot = {
  url: string;
  title?: string;
  total: number;
  returned: number;
  elements: BrowserWorkbenchInteractiveElement[];
};

export type BrowserWorkbenchElementTarget = {
  target: string;
  strategy?: "auto" | "ref" | "selector" | "xpath";
  index?: number;
};

export type BrowserWorkbenchElementActionName =
  | "click"
  | "dblclick"
  | "focus"
  | "hover"
  | "type"
  | "fill"
  | "select"
  | "check"
  | "uncheck"
  | "scrollIntoView";

export type BrowserWorkbenchElementActionResult = {
  url: string;
  title?: string;
  action: BrowserWorkbenchElementActionName;
  target: string;
  strategy: "ref" | "selector" | "xpath";
  found: boolean;
  value?: string;
  error?: string;
  node?: BrowserWorkbenchInteractiveElement;
};

export type BrowserWorkbenchElementInfoKind =
  | "text"
  | "html"
  | "value"
  | "attr"
  | "title"
  | "url"
  | "count"
  | "box"
  | "styles";

export type BrowserWorkbenchElementInfoInput = BrowserWorkbenchElementTarget & {
  kind: BrowserWorkbenchElementInfoKind;
  attribute?: string;
  properties?: string[];
};

export type BrowserWorkbenchElementInfoResult = {
  url: string;
  title?: string;
  kind: BrowserWorkbenchElementInfoKind;
  target?: string;
  strategy?: "ref" | "selector" | "xpath";
  found: boolean;
  count?: number;
  value?: string | number | boolean | null | Record<string, string> | { x: number; y: number; width: number; height: number };
  node?: BrowserWorkbenchInteractiveElement;
  error?: string;
};

export type BrowserWorkbenchScrollInput = {
  direction?: "up" | "down" | "left" | "right";
  amount?: number;
  target?: string;
  strategy?: "auto" | "ref" | "selector" | "xpath";
};

export type BrowserWorkbenchScrollResult = {
  url: string;
  title?: string;
  success: boolean;
  target?: string;
  scrollX: number;
  scrollY: number;
  error?: string;
};

export type BrowserWorkbenchWaitInput = {
  condition: "load" | "selector" | "text" | "url" | "time" | "function";
  value?: string;
  strategy?: "selector" | "xpath";
  state?: "visible" | "hidden" | "attached";
  timeoutMs?: number;
};

export type BrowserWorkbenchWaitResult = {
  url: string;
  title?: string;
  condition: BrowserWorkbenchWaitInput["condition"];
  success: boolean;
  timedOut: boolean;
  elapsedMs: number;
};

export type BrowserWorkbenchEvalResult = {
  url: string;
  title?: string;
  success: boolean;
  value?: unknown;
  error?: string;
};

export type BrowserWorkbenchKeyboardResult = {
  success: boolean;
  action: "press" | "down" | "up" | "type" | "insertText";
  key?: string;
  textLength?: number;
  state: BrowserWorkbenchState;
  error?: string;
};

export type BrowserWorkbenchMouseInput = {
  action: "move" | "down" | "up" | "wheel";
  x?: number;
  y?: number;
  button?: "left" | "right" | "middle";
  deltaX?: number;
  deltaY?: number;
};

export type BrowserWorkbenchMouseResult = {
  success: boolean;
  action: BrowserWorkbenchMouseInput["action"] | "click" | "dblclick";
  state: BrowserWorkbenchState;
  error?: string;
};

export type BrowserWorkbenchSavedFileResult = {
  url: string;
  title?: string;
  success: boolean;
  path: string;
  bytes?: number;
  format?: "png" | "jpeg" | "pdf";
  error?: string;
};

export type BrowserWorkbenchCookieInput = {
  action: "list" | "set" | "remove" | "flush";
  url?: string;
  name?: string;
  value?: string;
  domain?: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  expirationDate?: number;
};

export type BrowserWorkbenchCookieResult = {
  url: string;
  title?: string;
  action: BrowserWorkbenchCookieInput["action"];
  success: boolean;
  cookies?: Electron.Cookie[];
  count?: number;
  error?: string;
};

export type BrowserWorkbenchStorageInput = {
  action: "get" | "set" | "remove" | "clear";
  area?: "localStorage" | "sessionStorage";
  key?: string;
  value?: string;
};

export type BrowserWorkbenchStorageResult = {
  url: string;
  title?: string;
  action: BrowserWorkbenchStorageInput["action"];
  area: "localStorage" | "sessionStorage";
  success: boolean;
  value?: string | Record<string, string> | null;
  error?: string;
};

export type BrowserWorkbenchAnnotation = {
  id: string;
  url: string;
  title?: string;
  comment?: string;
  expectation?: string;
  styleEdits?: {
    source: string;
    changes: Array<{ property: string; before: string; after: string }>;
  };
  removed?: boolean;
  createdAt: number;
  point: { x: number; y: number };
  domHint?: BrowserWorkbenchDomHint;
};

export type BrowserWorkbenchEvent =
  | { type: "browser.open-requested"; payload: { url: string }; sessionId?: string }
  | { type: "browser.state"; payload: BrowserWorkbenchState; sessionId?: string }
  | { type: "browser.console"; payload: BrowserWorkbenchConsoleLog; sessionId?: string }
  | { type: "browser.annotation"; payload: BrowserWorkbenchAnnotation; sessionId?: string }
  | { type: "browser.recording"; payload: BrowserWorkbenchRecordingStatus; sessionId?: string }
  | { type: "browser.recording.package"; payload: BrowserWorkbenchRecordingResult; sessionId?: string }
  | { type: "browser.recording.run"; payload: BrowserWorkbenchRecordingRunEvent; sessionId?: string };

const ANNOTATION_PREFIX = "__TECH_CC_HUB_ANNOTATION__";
const RECORDER_PREFIX = "__TECH_CC_HUB_RECORDER__";
const BROWSER_WORKBENCH_ANNOTATION_CHANNEL = "browser-workbench-annotation";
const BROWSER_WORKBENCH_RECORDER_CHANNEL = "browser-workbench-recording";
const MAX_NETWORK_LOGS = 200;
const DEFAULT_NETWORK_LOG_LIMIT = 50;
const MAX_NETWORK_BODY_CHARS = 64_000;
const NETWORK_BODY_PREVIEW_CHARS = 600;
const MAX_JSON_FIELD_COUNT = 60;
const DEFAULT_BROWSER_HTTP_TIMEOUT_MS = 10_000;
const MAX_BROWSER_HTTP_TIMEOUT_MS = 60_000;
const SENSITIVE_HEADER_NAMES = new Set([
  "authorization",
  "cookie",
  "proxy-authorization",
  "set-cookie",
  "x-api-key",
  "x-auth-token",
  "x-csrf-token",
  "x-xsrf-token",
]);

const emptyState = (annotationMode = false): BrowserWorkbenchState => ({
  url: "",
  title: "",
  loading: false,
  canGoBack: false,
  canGoForward: false,
  annotationMode,
});

const emptyRecordingRunAttachments = () => ({
  traceFiles: [],
  screenshotFiles: [],
  videoFiles: [],
  otherFiles: [],
});

function previewText(value: string | undefined, maxChars = NETWORK_BODY_PREVIEW_CHARS): string | undefined {
  if (typeof value !== "string") return undefined;
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}...`;
}

function extractJsonScalarFields(value: string | undefined): Record<string, string | number | boolean | null> | undefined {
  if (!value?.trim()) return undefined;
  try {
    const parsed = JSON.parse(value) as unknown;
    const fields: Record<string, string | number | boolean | null> = {};
    const visit = (node: unknown, path: string, depth: number): void => {
      if (Object.keys(fields).length >= MAX_JSON_FIELD_COUNT || depth > 6) return;
      if (node === null || typeof node === "string" || typeof node === "number" || typeof node === "boolean") {
        fields[path || "$"] = node;
        return;
      }
      if (Array.isArray(node)) {
        node.slice(0, 8).forEach((item, index) => visit(item, `${path}[${index}]`, depth + 1));
        return;
      }
      if (typeof node === "object") {
        for (const [key, child] of Object.entries(node as Record<string, unknown>).slice(0, 40)) {
          visit(child, path ? `${path}.${key}` : key, depth + 1);
          if (Object.keys(fields).length >= MAX_JSON_FIELD_COUNT) return;
        }
      }
    };
    visit(parsed, "", 0);
    return Object.keys(fields).length > 0 ? fields : undefined;
  } catch {
    return undefined;
  }
}

function annotateNetworkBody(entry: BrowserWorkbenchNetworkLog): BrowserWorkbenchNetworkLog {
  return {
    ...entry,
    requestPostDataPreview: previewText(entry.requestPostData),
    responseBodyPreview: previewText(entry.responseBody),
    responseJsonFields: entry.responseBodyBase64Encoded ? undefined : extractJsonScalarFields(entry.responseBody),
  };
}

function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "about:blank";
  if (/^[a-z]+:\/\//i.test(trimmed) || trimmed.startsWith("file:") || trimmed === "about:blank") {
    return trimmed;
  }
  return `http://${trimmed}`;
}

function toLogLevel(level: unknown): BrowserWorkbenchConsoleLog["level"] {
  if (typeof level === "number") {
    if (level >= 3) return "error";
    if (level === 2) return "warn";
    if (level === 0) return "log";
    return "info";
  }
  if (level === "debug" || level === "info" || level === "log" || level === "warn" || level === "error") {
    return level;
  }
  return "log";
}

function readCdpString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readCdpNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function truncateNetworkText(value: string | undefined): { value?: string; truncated?: boolean } {
  if (!value) return {};
  if (value.length <= MAX_NETWORK_BODY_CHARS) {
    return { value };
  }
  return { value: value.slice(0, MAX_NETWORK_BODY_CHARS), truncated: true };
}

function stringifyHeaderValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).join(", ");
  }
  if (value == null) {
    return "";
  }
  return String(value);
}

function normalizeNetworkHeaders(headers: unknown): Record<string, string> | undefined {
  if (!headers || typeof headers !== "object" || Array.isArray(headers)) {
    return undefined;
  }
  const normalized: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers as Record<string, unknown>)) {
    const lowerName = name.toLowerCase();
    normalized[name] = SENSITIVE_HEADER_NAMES.has(lowerName) || lowerName.includes("token")
      ? "[redacted]"
      : stringifyHeaderValue(value);
  }
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function readCdpObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function networkStartedAt(params: Record<string, unknown>): number {
  const wallTime = readCdpNumber(params.wallTime);
  return wallTime ? Math.round(wallTime * 1000) : Date.now();
}

export class BrowserWorkbenchManager {
  private view: BrowserView | null = null;
  private bounds: BrowserWorkbenchBounds = { x: 0, y: 0, width: 0, height: 0 };
  private logs: BrowserWorkbenchConsoleLog[] = [];
  private networkLogs: BrowserWorkbenchNetworkLog[] = [];
  private networkLogsByRequestId = new Map<string, BrowserWorkbenchNetworkLog>();
  private readonly networkListenerContentIds = new Set<number>();
  private networkCaptureEnabled = false;
  private networkCaptureError: string | undefined;
  private annotationMode = false;
  private recordingSession: BrowserWorkbenchRecordingSession | null = null;
  private recordingAssertionMode = false;
  private recordingLocatorPickActionId: string | undefined;
  private lastRecordingResult: BrowserWorkbenchRecordingResult | null = null;
  private lastRecordingRunResult: BrowserWorkbenchRecordingRunResult | null = null;
  private recordingRunAbortController: AbortController | null = null;
  private listeners = new Set<(event: BrowserWorkbenchEvent) => void>();
  private cookieSyncCache = new Map<string, number>();
  private readonly COOKIE_SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes

  constructor(
    private readonly window: BrowserWindow,
    private readonly sessionId?: string,
    private readonly options: BrowserWorkbenchManagerOptions = {},
  ) {}

  open(url: string): BrowserWorkbenchState {
    const targetUrl = normalizeUrl(url);
    this.emit({ type: "browser.open-requested", payload: { url: targetUrl } });
    const view = this.ensureView();
    // Reattach the existing view without reloading when the URL is unchanged.
    const currentUrl = view.webContents.getURL();
    if (currentUrl && !view.webContents.isLoading()) {
      try {
        const currentParsed = new URL(currentUrl);
        const targetParsed = new URL(targetUrl);
        if (currentParsed.href === targetParsed.href) {
          view.setBounds(this.bounds);
          this.emitState();
          return this.getState();
        }
      } catch {
        // URL parse failed; fall through to loadURL.
      }
    }
    this.clearNetworkLogs();
    void this.syncChromeCookies(targetUrl).then(() => {
      if (!view.webContents.isDestroyed()) {
        view.webContents.loadURL(targetUrl);
      }
    });
    this.emitState();
    return this.getState();
  }

  close(): BrowserWorkbenchState {
    if (this.view) {
      const closingView = this.view;
      this.window.removeBrowserView(closingView);
      this.view = null;
      if (!closingView.webContents.isDestroyed()) {
        closingView.webContents.close({ waitForBeforeUnload: false });
      }
    }
    this.logs = [];
    this.clearNetworkLogs();
    this.annotationMode = false;
    if (this.recordingSession || this.recordingLocatorPickActionId) {
      this.recordingSession = null;
      this.recordingAssertionMode = false;
      this.recordingLocatorPickActionId = undefined;
      this.emit({ type: "browser.recording", payload: this.getRecordingState() });
    }
    this.lastRecordingResult = null;
    this.emitState();
    return this.getState();
  }

  setBounds(bounds: BrowserWorkbenchBounds): BrowserWorkbenchState {
    this.bounds = sanitizeBrowserWorkbenchBounds(bounds);
    if (this.view) {
      if (shouldDetachBrowserWorkbenchForBounds(this.bounds)) {
        this.detachView();
        return this.getState();
      }
      this.window.setBrowserView(this.view);
      this.view.setBounds(this.bounds);
    }
    return this.getState();
  }

  private detachView(): void {
    if (!this.view) return;
    try {
      this.window.removeBrowserView(this.view);
    } catch {
      // The view may already be detached by another active browser surface.
    }
    this.view.setBounds(this.bounds);
  }

  private shouldSyncCookies(domain: string): boolean {
    const lastSync = this.cookieSyncCache.get(domain);
    if (!lastSync) return true;
    return Date.now() - lastSync > this.COOKIE_SYNC_INTERVAL;
  }

  private async syncChromeCookies(url: string): Promise<void> {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname;

      if (!this.shouldSyncCookies(domain)) return;
      if (!isChromeInstalled()) return;

      const cookies = await getChromeCookes(domain);
      if (!this.view || this.view.webContents.isDestroyed()) return;

      const session = this.view.webContents.session;

      for (const cookie of cookies) {
        try {
          await session.cookies.set({
            url: cookie.url || `${urlObj.protocol}//${cookie.domain}${cookie.path}`,
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain,
            path: cookie.path,
            secure: cookie.secure,
            httpOnly: cookie.httpOnly,
            expirationDate: cookie.expirationDate,
            sameSite: cookie.sameSite as "unspecified" | "no_restriction" | "lax" | "strict" | undefined,
          });
        } catch {
          // Single cookie injection failure should not affect others
        }
      }

      this.cookieSyncCache.set(domain, Date.now());
    } catch (error) {
      console.warn("[browser-manager] Chrome cookie sync failed:", error);
    }
  }

  reload(): BrowserWorkbenchState {
    this.clearNetworkLogs();
    this.view?.webContents.reload();
    return this.getState();
  }

  openDevTools(): { opened: boolean } {
    if (!this.view) {
      return { opened: false };
    }
    const contents = this.view.webContents;
    if (contents.isDestroyed()) {
      return { opened: false };
    }
    try {
      contents.openDevTools({ mode: "right", activate: true });
      return { opened: true };
    } catch (error) {
      console.error("[browser-workbench] openDevTools failed:", error);
      return { opened: false };
    }
  }

  closeDevTools(): { opened: boolean } {
    if (!this.view) {
      return { opened: false };
    }
    const contents = this.view.webContents;
    if (contents.isDestroyed()) {
      return { opened: false };
    }
    try {
      contents.closeDevTools();
      return { opened: false };
    } catch (error) {
      console.error("[browser-workbench] closeDevTools failed:", error);
      return { opened: this.isDevToolsOpened() };
    }
  }

  isDevToolsOpened(): boolean {
    if (!this.view) return false;
    const contents = this.view.webContents;
    if (contents.isDestroyed()) return false;
    return contents.isDevToolsOpened();
  }

  goBack(): BrowserWorkbenchState {
    const contents = this.view?.webContents;
    if (contents?.canGoBack()) contents.goBack();
    return this.getState();
  }

  goForward(): BrowserWorkbenchState {
    const contents = this.view?.webContents;
    if (contents?.canGoForward()) contents.goForward();
    return this.getState();
  }

  getState(): BrowserWorkbenchState {
    const contents = this.view?.webContents;
    if (!contents || contents.isDestroyed()) {
      return emptyState(this.annotationMode);
    }

    return {
      url: contents.getURL(),
      title: contents.getTitle(),
      loading: contents.isLoading(),
      canGoBack: contents.canGoBack(),
      canGoForward: contents.canGoForward(),
      annotationMode: this.annotationMode,
    };
  }

  getConsoleLogs(limit = 80): BrowserWorkbenchConsoleLog[] {
    return this.logs.slice(-Math.min(Math.max(limit, 1), 300));
  }

  getNetworkLogs(input: BrowserWorkbenchNetworkLogInput = {}): { success: boolean; result?: BrowserWorkbenchNetworkLogResult; error?: string } {
    if (!this.view || this.view.webContents.isDestroyed()) {
      return { success: false, error: "Browser workbench is not open." };
    }

    const limit = Math.min(Math.max(Math.trunc(input.limit ?? DEFAULT_NETWORK_LOG_LIMIT), 1), MAX_NETWORK_LOGS);
    const urlContains = input.urlContains?.trim().toLowerCase();
    const resourceTypes = new Set(
      (input.resourceTypes ?? [])
        .map((type) => type.trim().toLowerCase())
        .filter(Boolean),
    );
    const includeBody = input.includeBody !== false;
    const includeHeaders = Boolean(input.includeHeaders);
    const entries = this.networkLogs
      .filter((entry) => {
        if (urlContains && !entry.url.toLowerCase().includes(urlContains)) {
          return false;
        }
        if (resourceTypes.size > 0 && !resourceTypes.has((entry.resourceType ?? "").toLowerCase())) {
          return false;
        }
        return true;
      })
      .slice(-limit)
      .map((entry) => {
        const next: BrowserWorkbenchNetworkLog = annotateNetworkBody(entry);
        if (!includeHeaders) {
          delete next.requestHeaders;
          delete next.responseHeaders;
        }
        if (!includeBody) {
          delete next.requestPostData;
          delete next.requestPostDataTruncated;
          delete next.responseBody;
          delete next.responseBodyBase64Encoded;
          delete next.responseBodyTruncated;
        }
        return next;
      });

    return {
      success: true,
      result: {
        url: this.view.webContents.getURL(),
        title: this.view.webContents.getTitle(),
        captureEnabled: this.networkCaptureEnabled,
        captureError: this.networkCaptureError,
        count: entries.length,
        entries,
      },
    };
  }

  getRecordingState(): BrowserWorkbenchRecordingStatus {
    return {
      ...getBrowserWorkbenchRecordingStatus(this.recordingSession),
      assertionMode: this.recordingAssertionMode,
      locatorPickActionId: this.recordingLocatorPickActionId,
    };
  }

  async startRecording(): Promise<BrowserWorkbenchRecordingResult> {
    if (!this.view || this.view.webContents.isDestroyed()) {
      return {
        success: false,
        recording: false,
        actionCount: 0,
        error: "Browser workbench is not open.",
      };
    }

    const state = this.getState();
    if (!state.url) {
      return {
        success: false,
        recording: false,
        actionCount: 0,
        error: "Open a page before recording.",
      };
    }

    this.recordingSession = createBrowserWorkbenchRecordingSession({
      url: state.url,
      title: state.title,
      viewport: {
        width: Math.max(1, Math.round(this.bounds.width)),
        height: Math.max(1, Math.round(this.bounds.height)),
      },
    });
    this.recordingAssertionMode = false;
    this.recordingLocatorPickActionId = undefined;
    await this.installRecordingScript();
    const status = this.getRecordingState();
    this.emit({ type: "browser.recording", payload: status });
    return {
      success: true,
      ...status,
    };
  }

  async stopRecording(): Promise<BrowserWorkbenchRecordingResult> {
    const session = this.recordingSession;
    if (!session) {
      return {
        success: false,
        recording: false,
        actionCount: 0,
        error: "No active browser recording.",
      };
    }

    this.recordingSession = null;
    await this.uninstallRecordingScript();
    const result = finalizeBrowserWorkbenchRecording(session, {
      evidence: {
        console: this.logs.slice(-80).map((entry, index) => ({
          id: `console-${index + 1}`,
          level: entry.level,
          message: entry.message,
          actionId: undefined,
          timestamp: entry.timestamp,
        })),
        network: this.networkLogs.slice(-120).map((entry) => ({
          id: entry.id,
          url: entry.url,
          method: entry.method,
          status: entry.status,
          actionId: undefined,
          timestamp: entry.startedAt,
        })),
        screenshots: [],
        snapshots: [],
      },
    });
    this.recordingAssertionMode = false;
    this.recordingLocatorPickActionId = undefined;
    if (result.recordingPackage) {
      try {
        const workspaceRoot = this.options.resolveWorkspaceRoot?.() || process.cwd();
        const writeResult = writeBrowserWorkbenchRecordingPackage(result.recordingPackage, workspaceRoot);
        result.savedRootPath = writeResult.rootPath;
      } catch (error) {
        result.saveError = error instanceof Error ? error.message : String(error);
      }
    }
    this.lastRecordingResult = result;
    this.emit({ type: "browser.recording", payload: this.getRecordingState() });
    return result;
  }

  async setRecordingAssertionMode(enabled: boolean): Promise<BrowserWorkbenchRecordingStatus> {
    if (!this.recordingSession) {
      this.recordingAssertionMode = false;
      return this.getRecordingState();
    }
    this.recordingAssertionMode = enabled;
    await this.installRecordingScript();
    const status = this.getRecordingState();
    this.emit({ type: "browser.recording", payload: status });
    return status;
  }

  async runRecording(input: { timeoutMs?: number } = {}): Promise<BrowserWorkbenchRecordingRunResult> {
    const workspaceRoot = this.options.resolveWorkspaceRoot?.() || process.cwd();
    if (this.recordingRunAbortController) {
      const now = Date.now();
      return {
        success: false,
        status: "error",
        recordingId: "",
        startedAt: now,
        endedAt: now,
        durationMs: 0,
        workspaceRoot,
        rootPath: "",
        specPath: "",
        outputDir: "",
        command: "",
        args: [],
        stdout: "",
        stderr: "",
        events: [],
        attachments: emptyRecordingRunAttachments(),
        error: "A Playwright recording run is already active.",
      };
    }
    const recordingResult = this.lastRecordingResult;
    if (!recordingResult?.recordingPackage) {
      const now = Date.now();
      return {
        success: false,
        status: "error",
        recordingId: "",
        startedAt: now,
        endedAt: now,
        durationMs: 0,
        workspaceRoot,
        rootPath: "",
        specPath: "",
        outputDir: "",
        command: "",
        args: [],
        stdout: "",
        stderr: "",
        events: [],
        attachments: emptyRecordingRunAttachments(),
        error: "No generated browser recording package to run.",
      };
    }

    const abortController = new AbortController();
    this.recordingRunAbortController = abortController;
    try {
      const runResult = await runBrowserWorkbenchRecordingPackage({
        workspaceRoot,
        recordingPackage: recordingResult.recordingPackage,
        savedRootPath: recordingResult.savedRootPath,
        timeoutMs: input.timeoutMs,
        signal: abortController.signal,
        onEvent: (event) => {
          this.emit({ type: "browser.recording.run", payload: event });
        },
      });
      this.lastRecordingRunResult = runResult;
      return runResult;
    } finally {
      if (this.recordingRunAbortController === abortController) {
        this.recordingRunAbortController = null;
      }
    }
  }

  cancelRecordingRun(): BrowserWorkbenchRecordingCancelRunResult {
    if (!this.recordingRunAbortController) {
      return { success: false, error: "No active Playwright recording run." };
    }
    this.recordingRunAbortController.abort();
    return { success: true };
  }

  async openRecordingRunOutput(): Promise<BrowserWorkbenchRecordingOpenPathResult> {
    const outputDir = this.lastRecordingRunResult?.outputDir;
    if (!outputDir) return { success: false, error: "No Playwright run output to open." };
    const error = await shell.openPath(outputDir);
    return error ? { success: false, path: outputDir, error } : { success: true, path: outputDir };
  }

  listRecordingHistory(limit = 30): BrowserWorkbenchRecordingHistoryItem[] {
    const workspaceRoot = this.options.resolveWorkspaceRoot?.() || process.cwd();
    return listBrowserWorkbenchRecordingHistory(workspaceRoot, limit);
  }

  loadRecordingHistory(rootPath: string): BrowserWorkbenchRecordingResult {
    const workspaceRoot = this.options.resolveWorkspaceRoot?.() || process.cwd();
    try {
      const recordingPackage = readBrowserWorkbenchRecordingPackage(workspaceRoot, rootPath);
      const result: BrowserWorkbenchRecordingResult = {
        success: true,
        recording: false,
        id: recordingPackage.id,
        startedAt: recordingPackage.recording.startedAt,
        url: recordingPackage.recording.source.url,
        title: recordingPackage.recording.source.title,
        actionCount: recordingPackage.recording.actions.length,
        actions: [...recordingPackage.recording.actions],
        fileName: recordingPackage.generatedSpecPath.split("/").pop(),
        recordingJson: recordingPackage.artifacts.find((artifact) => artifact.kind === "recording")?.content,
        recordingPackage,
        savedRootPath: rootPath,
      };
      this.lastRecordingResult = result;
      this.lastRecordingRunResult = null;
      this.emit({ type: "browser.recording.package", payload: result });
      return result;
    } catch (error) {
      return {
        success: false,
        recording: false,
        actionCount: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  updateRecordingArtifact(input: { artifactPath: string; content: string }): BrowserWorkbenchRecordingArtifactUpdateResult {
    const currentResult = this.lastRecordingResult;
    const recordingPackage = currentResult?.recordingPackage;
    if (!recordingPackage) {
      return {
        success: false,
        recordingPackage: {
          id: "",
          createdAt: Date.now(),
          rootPathHint: "",
          recordingPath: "",
          generatedSpecPath: "",
          recording: undefined as never,
          environment: undefined as never,
          dataScenarios: [],
          suite: undefined as never,
          diagnostics: [],
          artifacts: [],
        },
        artifactPath: input.artifactPath,
        error: "No generated browser recording package to edit.",
      };
    }
    const workspaceRoot = this.options.resolveWorkspaceRoot?.() || process.cwd();
    const result = updateBrowserWorkbenchRecordingArtifact({
      workspaceRoot,
      recordingPackage,
      artifactPath: input.artifactPath,
      content: input.content,
    });
    if (result.success) {
      this.lastRecordingResult = {
        ...currentResult,
        recordingPackage: result.recordingPackage,
        recordingJson: result.recordingPackage.artifacts.find((artifact) => artifact.kind === "recording")?.content,
      };
      this.emit({ type: "browser.recording.package", payload: this.lastRecordingResult });
    }
    return result;
  }

  async startRecordingLocatorPick(actionId: string): Promise<BrowserWorkbenchRecordingStatus> {
    const recordingPackage = this.lastRecordingResult?.recordingPackage;
    const canRepair = Boolean(actionId && recordingPackage?.recording.actions.some((action) => action.id === actionId));
    if (!canRepair) {
      this.recordingLocatorPickActionId = undefined;
      return this.getRecordingState();
    }
    this.recordingLocatorPickActionId = actionId;
    await this.installRecordingScript();
    const status = this.getRecordingState();
    this.emit({ type: "browser.recording", payload: status });
    return status;
  }

  async cancelRecordingLocatorPick(): Promise<BrowserWorkbenchRecordingStatus> {
    this.recordingLocatorPickActionId = undefined;
    if (this.recordingSession) {
      await this.installRecordingScript();
    } else {
      await this.uninstallRecordingScript();
    }
    const status = this.getRecordingState();
    this.emit({ type: "browser.recording", payload: status });
    return status;
  }

  async addRecordingAssertion(input: { kind: BrowserWorkbenchRecordedAction["kind"]; value?: string; key?: string; selector?: string }): Promise<BrowserWorkbenchRecordingResult> {
    if (!this.recordingSession) {
      return { success: false, recording: false, actionCount: 0, error: "Start browser recording before adding assertions." };
    }
    const state = this.getState();
    const value = input.value?.trim();
    const kind = input.kind;
    const action = appendBrowserWorkbenchRecordedAction(this.recordingSession, {
      kind,
      timestamp: Date.now(),
      url: state.url,
      title: state.title,
      value: kind === "assertUrl" ? value || state.url : kind === "assertTitle" ? value || state.title : value,
      key: input.key,
      target: input.selector ? { selector: input.selector } : undefined,
    });
    if (!action) {
      return { success: false, recording: true, actionCount: this.recordingSession.actions.length, error: "Assertion payload is not valid for this recording." };
    }
    const status = this.getRecordingState();
    this.emit({ type: "browser.recording", payload: status });
    return { success: true, ...status };
  }

  async openRecordingTraceViewer(): Promise<BrowserWorkbenchRecordingOpenPathResult> {
    const runResult = this.lastRecordingRunResult;
    const tracePath = runResult?.attachments.traceFiles[0];
    if (!tracePath) return { success: false, error: "No Playwright trace file to open." };
    const command = runResult.command;
    if (command) {
      try {
        const child = spawn(command, ["show-trace", tracePath], {
          cwd: runResult.workspaceRoot,
          detached: true,
          stdio: "ignore",
          windowsHide: true,
        });
        child.unref();
        return { success: true, path: tracePath };
      } catch (error) {
        return { success: false, path: tracePath, error: error instanceof Error ? error.message : String(error) };
      }
    }
    const error = await shell.openPath(tracePath);
    return error ? { success: false, path: tracePath, error } : { success: true, path: tracePath };
  }

  async repairRecordingLocator(input: { actionId: string; selector: string }): Promise<BrowserWorkbenchRecordingResult> {
    const recordingPackage = this.lastRecordingResult?.recordingPackage;
    if (!recordingPackage) {
      return { success: false, recording: false, actionCount: 0, error: "No generated browser recording package to repair." };
    }
    const selector = input.selector.trim();
    if (!input.actionId || !selector) {
      return { success: false, recording: false, actionCount: 0, error: "actionId and selector are required." };
    }
    const actions = recordingPackage.recording.actions.map((action) => {
      if (action.id !== input.actionId) return action;
      return {
        ...action,
        target: {
          ...action.target,
          selector,
        },
      };
    });
    const changed = actions.some((action, index) => action !== recordingPackage.recording.actions[index]);
    if (!changed) {
      return { success: false, recording: false, actionCount: recordingPackage.recording.actions.length, error: "Recording action not found." };
    }
    const session: BrowserWorkbenchRecordingSession = {
      id: recordingPackage.id,
      startedAt: recordingPackage.recording.startedAt,
      startUrl: recordingPackage.recording.source.url,
      startTitle: recordingPackage.recording.source.title,
      viewport: recordingPackage.recording.source.viewport,
      actions,
    };
    const result = finalizeBrowserWorkbenchRecording(session, { evidence: recordingPackage.recording.evidence });
    if (result.recordingPackage) {
      try {
        const workspaceRoot = this.options.resolveWorkspaceRoot?.() || process.cwd();
        const writeResult = writeBrowserWorkbenchRecordingPackage(result.recordingPackage, workspaceRoot);
        result.savedRootPath = writeResult.rootPath;
      } catch (error) {
        result.saveError = error instanceof Error ? error.message : String(error);
      }
    }
    this.lastRecordingResult = result;
    this.lastRecordingRunResult = null;
    this.recordingLocatorPickActionId = undefined;
    this.emit({ type: "browser.recording", payload: this.getRecordingState() });
    this.emit({ type: "browser.recording.package", payload: result });
    return result;
  }

  addEventListener(listener: (event: BrowserWorkbenchEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async captureVisible(): Promise<{ success: boolean; dataUrl?: string; error?: string }> {
    if (!this.view) {
      return { success: false, error: "浏览器工作台尚未打开页面。" };
    }

    try {
      const image = await this.view.webContents.capturePage();
      return { success: true, dataUrl: image.toDataURL() };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async saveScreenshot(input: { path?: string; format?: "png" | "jpeg"; quality?: number }): Promise<{ success: boolean; result?: BrowserWorkbenchSavedFileResult; error?: string }> {
    if (!this.view || this.view.webContents.isDestroyed()) {
      return { success: false, error: "浏览器工作台尚未打开页面。" };
    }

    const format = input.format === "jpeg" ? "jpeg" : "png";
    const filePath = input.path?.trim() || join(tmpdir(), `tech-cc-hub-browser-${Date.now()}.${format === "jpeg" ? "jpg" : "png"}`);
    try {
      const image = await this.view.webContents.capturePage();
      const buffer = format === "jpeg"
        ? image.toJPEG(Math.max(1, Math.min(Math.trunc(input.quality ?? 90), 100)))
        : image.toPNG();
      if (buffer.length === 0) {
        const result: BrowserWorkbenchSavedFileResult = {
          url: this.view.webContents.getURL(),
          title: this.view.webContents.getTitle(),
          success: false,
          path: filePath,
          bytes: 0,
          format,
          error: "BrowserView screenshot capture returned an empty image.",
        };
        return { success: false, result, error: result.error };
      }
      mkdirSync(dirname(filePath), { recursive: true });
      writeFileSync(filePath, buffer);
      const result: BrowserWorkbenchSavedFileResult = {
        url: this.view.webContents.getURL(),
        title: this.view.webContents.getTitle(),
        success: true,
        path: filePath,
        bytes: buffer.length,
        format,
      };
      return { success: true, result };
    } catch (error) {
      const result: BrowserWorkbenchSavedFileResult = {
        url: this.view.webContents.getURL(),
        title: this.view.webContents.getTitle(),
        success: false,
        path: filePath,
        format,
        error: error instanceof Error ? error.message : String(error),
      };
      return { success: false, result, error: result.error };
    }
  }

  async savePdf(input: { path?: string; landscape?: boolean; printBackground?: boolean }): Promise<{ success: boolean; result?: BrowserWorkbenchSavedFileResult; error?: string }> {
    if (!this.view || this.view.webContents.isDestroyed()) {
      return { success: false, error: "浏览器工作台尚未打开页面。" };
    }

    const filePath = input.path?.trim() || join(tmpdir(), `tech-cc-hub-browser-${Date.now()}.pdf`);
    try {
      const buffer = await this.view.webContents.printToPDF({
        landscape: Boolean(input.landscape),
        printBackground: input.printBackground ?? true,
      });
      mkdirSync(dirname(filePath), { recursive: true });
      writeFileSync(filePath, buffer);
      const result: BrowserWorkbenchSavedFileResult = {
        url: this.view.webContents.getURL(),
        title: this.view.webContents.getTitle(),
        success: true,
        path: filePath,
        bytes: buffer.length,
        format: "pdf",
      };
      return { success: true, result };
    } catch (error) {
      const result: BrowserWorkbenchSavedFileResult = {
        url: this.view.webContents.getURL(),
        title: this.view.webContents.getTitle(),
        success: false,
        path: filePath,
        format: "pdf",
        error: error instanceof Error ? error.message : String(error),
      };
      return { success: false, result, error: result.error };
    }
  }

  async inspectAtPoint(point: { x: number; y: number }): Promise<BrowserWorkbenchDomHint | null> {
    if (!this.view) return null;
    return await this.view.webContents.executeJavaScript(
      `(${this.buildInspectScript()})(${JSON.stringify(point)})`,
      true,
    ) as BrowserWorkbenchDomHint | null;
  }

  async setAnnotationMode(enabled: boolean): Promise<BrowserWorkbenchState> {
    this.annotationMode = enabled;
    if (this.view) {
      await this.installAnnotationScript();
    }
    this.emitState();
    return this.getState();
  }

  async clearAnnotations(): Promise<BrowserWorkbenchState> {
    if (this.view && !this.view.webContents.isDestroyed()) {
      try {
        await this.view.webContents.executeJavaScript(`(${this.buildClearAnnotationsScript()})()`, true);
      } catch {
        // Ignore script cleanup errors so state can still be reset on the renderer side.
      }
      if (this.annotationMode) {
        await this.installAnnotationScript();
      }
    }
    return this.getState();
  }

  async removeAnnotation(annotationId: string): Promise<BrowserWorkbenchState> {
    if (this.view && !this.view.webContents.isDestroyed()) {
      try {
        await this.view.webContents.executeJavaScript(
          `(${this.buildRemoveAnnotationScript()})(${JSON.stringify(annotationId)})`,
          true,
        );
      } catch {
        // Ignore script cleanup errors so the renderer-side draft can still be updated.
      }
    }
    return this.getState();
  }

  async extractPageSnapshot(): Promise<{ success: boolean; snapshot?: BrowserWorkbenchPageSnapshot; error?: string }> {
    if (!this.view || this.view.webContents.isDestroyed()) {
      return { success: false, error: "浏览器工作台尚未打开页面。" };
    }

    try {
      const snapshot = await this.view.webContents.executeJavaScript(
        `(${this.buildPageSnapshotScript()})()`,
        true,
      ) as BrowserWorkbenchPageSnapshot;
      return { success: true, snapshot };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async getDomStats(): Promise<{ success: boolean; stats?: BrowserWorkbenchDomStats; error?: string }> {
    if (!this.view || this.view.webContents.isDestroyed()) {
      return { success: false, error: "浏览器工作台尚未打开页面。" };
    }

    try {
      const stats = await this.view.webContents.executeJavaScript(
        `(${this.buildDomStatsScript()})()`,
        true,
      ) as BrowserWorkbenchDomStats;
      return { success: true, stats };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async getInteractiveSnapshot(input: { maxResults?: number; visibleOnly?: boolean } = {}): Promise<{ success: boolean; snapshot?: BrowserWorkbenchInteractiveSnapshot; error?: string }> {
    if (!this.view || this.view.webContents.isDestroyed()) {
      return { success: false, error: "浏览器工作台尚未打开页面。" };
    }

    try {
      const snapshot = await this.view.webContents.executeJavaScript(
        `(${this.buildInteractiveSnapshotScript()})(${JSON.stringify(input)})`,
        true,
      ) as BrowserWorkbenchInteractiveSnapshot;
      return { success: true, snapshot };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async clickElement(input: BrowserWorkbenchElementTarget): Promise<{ success: boolean; result?: BrowserWorkbenchElementActionResult; error?: string }> {
    return await this.runElementAction({ ...input, action: "click" });
  }

  async fillElement(input: BrowserWorkbenchElementTarget & { value: string }): Promise<{ success: boolean; result?: BrowserWorkbenchElementActionResult; error?: string }> {
    return await this.runElementAction({ ...input, action: "fill" });
  }

  async runElementAction(input: BrowserWorkbenchElementTarget & { action: BrowserWorkbenchElementActionName; value?: string }): Promise<{ success: boolean; result?: BrowserWorkbenchElementActionResult; error?: string }> {
    if (!this.view || this.view.webContents.isDestroyed()) {
      return { success: false, error: "浏览器工作台尚未打开页面。" };
    }

    try {
      const result = await this.view.webContents.executeJavaScript(
        `(${this.buildElementActionScript()})(${JSON.stringify(input)})`,
        true,
      ) as BrowserWorkbenchElementActionResult;
      return { success: result.found && !result.error, result, error: result.error };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async getElementInfo(input: BrowserWorkbenchElementInfoInput): Promise<{ success: boolean; result?: BrowserWorkbenchElementInfoResult; error?: string }> {
    if (!this.view || this.view.webContents.isDestroyed()) {
      return { success: false, error: "浏览器工作台尚未打开页面。" };
    }

    try {
      const result = await this.view.webContents.executeJavaScript(
        `(${this.buildElementInfoScript()})(${JSON.stringify(input)})`,
        true,
      ) as BrowserWorkbenchElementInfoResult;
      return { success: result.found && !result.error, result, error: result.error };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  pressKey(key: string): { success: boolean; key: string; state: BrowserWorkbenchState; error?: string } {
    const result = this.sendKeyEvent("press", key);
    return {
      success: result.success,
      key: result.key ?? key,
      state: result.state,
      error: result.error,
    };
  }

  sendKeyEvent(action: "press" | "down" | "up", key: string): BrowserWorkbenchKeyboardResult {
    if (!this.view || this.view.webContents.isDestroyed()) {
      return { success: false, action, key, state: this.getState(), error: "浏览器工作台尚未打开页面。" };
    }

    const normalizedKey = key.trim();
    if (!normalizedKey || normalizedKey.length > 64) {
      return { success: false, action, key, state: this.getState(), error: "按键名称不能为空或过长。" };
    }

    try {
      this.view.webContents.focus();
      if (action === "press" || action === "down") {
        this.view.webContents.sendInputEvent({ type: "keyDown", keyCode: normalizedKey });
      }
      if (action === "press" || action === "up") {
        this.view.webContents.sendInputEvent({ type: "keyUp", keyCode: normalizedKey });
      }
      return { success: true, action, key: normalizedKey, state: this.getState() };
    } catch (error) {
      return { success: false, action, key: normalizedKey, state: this.getState(), error: error instanceof Error ? error.message : String(error) };
    }
  }

  sendKeyboardText(action: "type" | "insertText", text: string): BrowserWorkbenchKeyboardResult {
    if (!this.view || this.view.webContents.isDestroyed()) {
      return { success: false, action, textLength: text.length, state: this.getState(), error: "浏览器工作台尚未打开页面。" };
    }

    try {
      this.view.webContents.focus();
      if (action === "insertText") {
        this.view.webContents.insertText(text);
      } else {
        for (const char of text) {
          this.view.webContents.sendInputEvent({ type: "char", keyCode: char });
        }
      }
      return { success: true, action, textLength: text.length, state: this.getState() };
    } catch (error) {
      return { success: false, action, textLength: text.length, state: this.getState(), error: error instanceof Error ? error.message : String(error) };
    }
  }

  sendMouseEvent(input: BrowserWorkbenchMouseInput): BrowserWorkbenchMouseResult {
    if (!this.view || this.view.webContents.isDestroyed()) {
      return { success: false, action: input.action, state: this.getState(), error: "浏览器工作台尚未打开页面。" };
    }

    try {
      this.view.webContents.focus();
      if (input.action === "wheel") {
        this.view.webContents.sendInputEvent({
          type: "mouseWheel",
          x: Math.max(0, Math.trunc(input.x ?? 0)),
          y: Math.max(0, Math.trunc(input.y ?? 0)),
          deltaX: Math.trunc(input.deltaX ?? 0),
          deltaY: Math.trunc(input.deltaY ?? 0),
        });
      } else {
        this.view.webContents.sendInputEvent({
          type: input.action === "move" ? "mouseMove" : input.action === "down" ? "mouseDown" : "mouseUp",
          x: Math.max(0, Math.trunc(input.x ?? 0)),
          y: Math.max(0, Math.trunc(input.y ?? 0)),
          button: input.button ?? "left",
          clickCount: 1,
        });
      }
      return { success: true, action: input.action, state: this.getState() };
    } catch (error) {
      return { success: false, action: input.action, state: this.getState(), error: error instanceof Error ? error.message : String(error) };
    }
  }

  async evaluateJavaScript(expression: string): Promise<{ success: boolean; result?: BrowserWorkbenchEvalResult; error?: string }> {
    if (!this.view || this.view.webContents.isDestroyed()) {
      return { success: false, error: "浏览器工作台尚未打开页面。" };
    }

    try {
      const value = await this.view.webContents.executeJavaScript(expression, true) as unknown;
      const result: BrowserWorkbenchEvalResult = {
        url: this.view.webContents.getURL(),
        title: this.view.webContents.getTitle(),
        success: true,
        value,
      };
      return { success: true, result };
    } catch (error) {
      const baseError = error instanceof Error ? error.message : String(error);
      const hint = /could not be cloned|object could not be cloned|clone/i.test(baseError)
        ? " Return only JSON-serializable values; DOMRect, HTMLElement, Function, Map, Set, and class instances should be converted to plain objects or strings first."
        : "";
      const result: BrowserWorkbenchEvalResult = {
        url: this.view.webContents.getURL(),
        title: this.view.webContents.getTitle(),
        success: false,
        error: `${baseError}${hint}`,
      };
      return { success: false, result, error: result.error };
    }
  }

  async httpRequest(input: BrowserWorkbenchHttpRequestInput): Promise<{ success: boolean; result?: BrowserWorkbenchHttpRequestResult; error?: string }> {
    if (!this.view || this.view.webContents.isDestroyed()) {
      return { success: false, error: "Browser workbench is not open." };
    }
    const method = (input.method?.trim() || "GET").toUpperCase();
    const timeoutMs = Math.min(Math.max(Math.trunc(input.timeoutMs ?? DEFAULT_BROWSER_HTTP_TIMEOUT_MS), 100), MAX_BROWSER_HTTP_TIMEOUT_MS);
    const startedAt = Date.now();
    try {
      const payload = {
        method,
        url: input.url,
        body: input.body,
        headers: input.headers ?? {},
        contentType: input.contentType,
        timeoutMs,
      };
      const value = await this.view.webContents.executeJavaScript(`(async (input) => {
        const startedAt = Date.now();
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), input.timeoutMs);
        const headers = { ...(input.headers || {}) };
        if (input.contentType && !Object.keys(headers).some((key) => key.toLowerCase() === "content-type")) {
          headers["content-type"] = input.contentType;
        }
        try {
          const requestUrl = new URL(input.url, window.location.href).toString();
          const response = await fetch(requestUrl, {
            method: input.method,
            headers,
            body: typeof input.body === "string" ? input.body : undefined,
            credentials: "include",
            signal: controller.signal,
          });
          const responseHeaders = {};
          response.headers.forEach((value, key) => {
            responseHeaders[key] = value;
          });
          const responseBody = await response.text();
          return {
            requestUrl,
            method: input.method,
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
            redirected: response.redirected,
            responseUrl: response.url,
            responseHeaders,
            responseBody,
            contentType: response.headers.get("content-type") || undefined,
            durationMs: Date.now() - startedAt,
          };
        } catch (error) {
          return {
            requestUrl: input.url,
            method: input.method,
            durationMs: Date.now() - startedAt,
            error: error && error.message ? error.message : String(error),
          };
        } finally {
          clearTimeout(timer);
        }
      })(${JSON.stringify(payload)})`, true) as Omit<BrowserWorkbenchHttpRequestResult, "url" | "title" | "responseBodyPreview" | "responseBodyTruncated" | "responseJsonFields">;

      const result: BrowserWorkbenchHttpRequestResult = {
        ...value,
        url: this.view.webContents.getURL(),
        title: this.view.webContents.getTitle(),
        responseBody: value.responseBody,
        responseBodyPreview: previewText(value.responseBody),
        responseBodyTruncated: typeof value.responseBody === "string" && value.responseBody.length > NETWORK_BODY_PREVIEW_CHARS,
        responseJsonFields: extractJsonScalarFields(value.responseBody),
        durationMs: typeof value.durationMs === "number" ? value.durationMs : Date.now() - startedAt,
      };
      return { success: !result.error, result, error: result.error };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const result: BrowserWorkbenchHttpRequestResult = {
        url: this.view.webContents.getURL(),
        title: this.view.webContents.getTitle(),
        requestUrl: input.url,
        method,
        durationMs: Date.now() - startedAt,
        error: message,
      };
      return { success: false, result, error: message };
    }
  }

  async manageCookies(input: BrowserWorkbenchCookieInput): Promise<{ success: boolean; result?: BrowserWorkbenchCookieResult; error?: string }> {
    if (!this.view || this.view.webContents.isDestroyed()) {
      return { success: false, error: "浏览器工作台尚未打开页面。" };
    }

    const currentUrl = this.view.webContents.getURL();
    const url = input.url?.trim() || currentUrl;
    try {
      if (input.action === "list") {
        const cookies = await this.view.webContents.session.cookies.get({ url });
        const result: BrowserWorkbenchCookieResult = {
          url: currentUrl,
          title: this.view.webContents.getTitle(),
          action: input.action,
          success: true,
          cookies,
          count: cookies.length,
        };
        return { success: true, result };
      }
      if (input.action === "flush") {
        await this.view.webContents.session.cookies.flushStore();
        const result: BrowserWorkbenchCookieResult = {
          url: currentUrl,
          title: this.view.webContents.getTitle(),
          action: input.action,
          success: true,
        };
        return { success: true, result };
      }
      if (!input.name) {
        throw new Error("Cookie name is required.");
      }
      if (input.action === "remove") {
        await this.view.webContents.session.cookies.remove(url, input.name);
        const result: BrowserWorkbenchCookieResult = {
          url: currentUrl,
          title: this.view.webContents.getTitle(),
          action: input.action,
          success: true,
        };
        return { success: true, result };
      }
      await this.view.webContents.session.cookies.set({
        url,
        name: input.name,
        value: input.value ?? "",
        domain: input.domain,
        path: input.path,
        secure: input.secure,
        httpOnly: input.httpOnly,
        expirationDate: input.expirationDate,
      });
      const result: BrowserWorkbenchCookieResult = {
        url: currentUrl,
        title: this.view.webContents.getTitle(),
        action: input.action,
        success: true,
      };
      return { success: true, result };
    } catch (error) {
      const result: BrowserWorkbenchCookieResult = {
        url: currentUrl,
        title: this.view.webContents.getTitle(),
        action: input.action,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
      return { success: false, result, error: result.error };
    }
  }

  async manageStorage(input: BrowserWorkbenchStorageInput): Promise<{ success: boolean; result?: BrowserWorkbenchStorageResult; error?: string }> {
    if (!this.view || this.view.webContents.isDestroyed()) {
      return { success: false, error: "浏览器工作台尚未打开页面。" };
    }

    try {
      const result = await this.view.webContents.executeJavaScript(
        `(${this.buildStorageScript()})(${JSON.stringify(input)})`,
        true,
      ) as BrowserWorkbenchStorageResult;
      return { success: result.success, result, error: result.error };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async scrollPage(input: BrowserWorkbenchScrollInput): Promise<{ success: boolean; result?: BrowserWorkbenchScrollResult; error?: string }> {
    if (!this.view || this.view.webContents.isDestroyed()) {
      return { success: false, error: "浏览器工作台尚未打开页面。" };
    }

    try {
      const result = await this.view.webContents.executeJavaScript(
        `(${this.buildScrollScript()})(${JSON.stringify(input)})`,
        true,
      ) as BrowserWorkbenchScrollResult;
      return { success: result.success, result, error: result.error };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async waitFor(input: BrowserWorkbenchWaitInput): Promise<{ success: boolean; result?: BrowserWorkbenchWaitResult; error?: string }> {
    if (!this.view || this.view.webContents.isDestroyed()) {
      return { success: false, error: "浏览器工作台尚未打开页面。" };
    }

    try {
      const result = await this.view.webContents.executeJavaScript(
        `(${this.buildWaitScript()})(${JSON.stringify(input)})`,
        true,
      ) as BrowserWorkbenchWaitResult;
      return { success: result.success, result, error: result.timedOut ? "等待超时。" : undefined };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async queryNodes(input: {
    strategy?: BrowserWorkbenchQueryStrategy;
    query: string;
    maxResults?: number;
    includeStyles?: boolean;
    styleProps?: string[];
  }): Promise<{ success: boolean; result?: BrowserWorkbenchNodeQueryResult; error?: string }> {
    if (!this.view || this.view.webContents.isDestroyed()) {
      return { success: false, error: "浏览器工作台尚未打开页面。" };
    }

    try {
      const result = await this.view.webContents.executeJavaScript(
        `(${this.buildQueryNodesScript()})(${JSON.stringify(input)})`,
        true,
      ) as BrowserWorkbenchNodeQueryResult;
      return { success: true, result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async inspectStyles(input: {
    strategy?: BrowserWorkbenchQueryStrategy;
    query: string;
    index?: number;
    properties?: string[];
  }): Promise<{ success: boolean; inspection?: BrowserWorkbenchStyleInspection; error?: string }> {
    if (!this.view || this.view.webContents.isDestroyed()) {
      return { success: false, error: "浏览器工作台尚未打开页面。" };
    }

    try {
      const inspection = await this.view.webContents.executeJavaScript(
        `(${this.buildInspectStylesScript()})(${JSON.stringify(input)})`,
        true,
      ) as BrowserWorkbenchStyleInspection;
      return { success: true, inspection };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async applyStyles(input: BrowserWorkbenchStyleApplyInput): Promise<{ success: boolean; result?: BrowserWorkbenchStyleApplyResult; error?: string }> {
    if (!this.view || this.view.webContents.isDestroyed()) {
      return { success: false, error: "Browser workbench is not open." };
    }

    try {
      const result = await this.view.webContents.executeJavaScript(
        `(${this.buildApplyStylesScript()})(${JSON.stringify(input)})`,
        true,
      ) as BrowserWorkbenchStyleApplyResult;
      return { success: result.found && !result.error, result, error: result.error };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  // Source: chrome-devtools-mcp/src/tools/input.ts (click)
  clickAt(input: { x: number; y: number; dblClick?: boolean }): BrowserWorkbenchMouseResult {
    if (!this.view || this.view.webContents.isDestroyed()) {
      return { success: false, action: "click", state: this.getState(), error: "浏览器工作台尚未打开页面。" };
    }
    try {
      const x = Math.max(0, Math.trunc(input.x));
      const y = Math.max(0, Math.trunc(input.y));
      const dispatchDomClick = async () => {
        await this.view?.webContents.executeJavaScript(
          `(() => {
            const x = ${JSON.stringify(x)};
            const y = ${JSON.stringify(y)};
            const element = document.elementFromPoint(x, y);
            if (!element) return false;
            const options = { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, buttons: 1, view: window };
            element.dispatchEvent(new MouseEvent("mousemove", options));
            element.dispatchEvent(new MouseEvent("mousedown", options));
            element.dispatchEvent(new MouseEvent("mouseup", { ...options, buttons: 0 }));
            element.dispatchEvent(new MouseEvent("click", { ...options, buttons: 0 }));
            return true;
          })()`,
          true,
        );
      };
      this.view.webContents.focus();
      void dispatchDomClick().catch((error) => {
        this.handleConsoleMessage(
          "warn",
          `[browser-workbench] DOM click fallback failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
      if (this.view.webContents.debugger.isAttached()) {
        void (async () => {
          try {
            await this.view?.webContents.debugger.sendCommand("Input.dispatchMouseEvent", {
              type: "mouseMoved",
              x,
              y,
            });
            await this.view?.webContents.debugger.sendCommand("Input.dispatchMouseEvent", {
              type: "mousePressed",
              x,
              y,
              button: "left",
              clickCount: 1,
            });
            await this.view?.webContents.debugger.sendCommand("Input.dispatchMouseEvent", {
              type: "mouseReleased",
              x,
              y,
              button: "left",
              clickCount: 1,
            });
            if (input.dblClick) {
              await this.view?.webContents.debugger.sendCommand("Input.dispatchMouseEvent", {
                type: "mousePressed",
                x,
                y,
                button: "left",
                clickCount: 2,
              });
              await this.view?.webContents.debugger.sendCommand("Input.dispatchMouseEvent", {
                type: "mouseReleased",
                x,
                y,
                button: "left",
                clickCount: 2,
              });
            }
          } catch (error) {
            this.handleConsoleMessage(
              "warn",
              `[browser-workbench] CDP click failed: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        })();
        return { success: true, action: input.dblClick ? "dblclick" : "click", state: this.getState() };
      }
      this.view.webContents.sendInputEvent({
        type: "mouseMove",
        x,
        y,
      });
      this.view.webContents.sendInputEvent({
        type: "mouseDown",
        x,
        y,
        button: "left",
        clickCount: 1,
      });
      this.view.webContents.sendInputEvent({
        type: "mouseUp",
        x,
        y,
        button: "left",
        clickCount: 1,
      });
      if (input.dblClick) {
        this.view.webContents.sendInputEvent({
          type: "mouseDown",
          x,
          y,
          button: "left",
          clickCount: 2,
        });
        this.view.webContents.sendInputEvent({
          type: "mouseUp",
          x,
          y,
          button: "left",
          clickCount: 2,
        });
      }
      return { success: true, action: input.dblClick ? "dblclick" : "click", state: this.getState() };
    } catch (error) {
      return { success: false, action: "click", state: this.getState(), error: error instanceof Error ? error.message : String(error) };
    }
  }

  async dragElement(input: { from_uid: string; to_uid: string; strategy?: "auto" | "ref" | "selector" | "xpath"; index?: number }): Promise<{ success: boolean; error?: string }> {
    if (!this.view || this.view.webContents.isDestroyed()) {
      return { success: false, error: "浏览器工作台尚未打开页面。" };
    }
    try {
      const result = await this.view.webContents.executeJavaScript(
        `(${this.buildDragScript()})(${JSON.stringify(input)})`,
        true,
      ) as { success: boolean; error?: string };
      return result;
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  resizeView(input: { width: number; height: number }): BrowserWorkbenchState {
    const w = Math.max(100, Math.trunc(input.width));
    const h = Math.max(100, Math.trunc(input.height));
    this.bounds = { ...this.bounds, width: w, height: h };
    if (this.view) {
      this.view.setBounds(this.bounds);
    }
    this.emitState();
    return this.getState();
  }

  // Source: chrome-devtools-mcp/src/tools/input.ts (handle_dialog)
  async handleDialog(input: { action: "accept" | "dismiss"; promptText?: string }): Promise<{ success: boolean; message?: string; error?: string }> {
    if (!this.view || this.view.webContents.isDestroyed()) {
      return { success: false, error: "浏览器工作台尚未打开页面。" };
    }
    const contents = this.view.webContents;
    const wasAttached = contents.debugger.isAttached();
    try {
      if (!wasAttached) {
        contents.debugger.attach();
      }
      await contents.debugger.sendCommand("Page.enable");
      if (input.action === "accept") {
        await contents.debugger.sendCommand("Page.handleJavaScriptDialog", {
          accept: true,
          promptText: input.promptText || "",
        });
      } else {
        await contents.debugger.sendCommand("Page.handleJavaScriptDialog", {
          accept: false,
        });
      }
      return { success: true, message: input.action === "accept" ? "已接受对话框" : "已拒绝对话框" };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    } finally {
      if (!wasAttached) {
        try { contents.debugger.detach(); } catch { /* ignore */ }
      }
    }
  }

  // Source: chrome-devtools-mcp/src/tools/snapshot.ts
  async enhancedSnapshot(input: { maxResults?: number; visibleOnly?: boolean }): Promise<{ success: boolean; snapshot?: BrowserWorkbenchInteractiveSnapshot; error?: string }> {
    return this.getInteractiveSnapshot({
      maxResults: input.maxResults,
      visibleOnly: input.visibleOnly ?? true,
    });
  }

  // Source: chrome-devtools-mcp/src/tools/input.ts (upload_file)
  async uploadFile(input: { target: string; filePath: string; strategy?: "auto" | "ref" | "selector" | "xpath"; index?: number }): Promise<{ success: boolean; path?: string; error?: string }> {
    if (!this.view || this.view.webContents.isDestroyed()) {
      return { success: false, error: "浏览器工作台尚未打开页面。" };
    }
    const contents = this.view.webContents;
    const wasAttached = contents.debugger.isAttached();
    try {
      if (!wasAttached) {
        contents.debugger.attach();
      }
      // Inject a unique marker script to find the file input and set a data attribute
      const markId = `cc-hub-upload-${Date.now()}`;
      const markResult = await contents.executeJavaScript(
        `(${this.buildUploadFileScript()})(${JSON.stringify({ ...input, markId })})`,
        true,
      ) as { success: boolean; error?: string };
      if (!markResult.success) {
        return { success: false, error: markResult.error || "文件上传元素未找到" };
      }
      // Use CDP DOM.setFileInputFiles to programmatically set files
      const doc = await contents.debugger.sendCommand("DOM.getDocument") as { root: { nodeId: number } };
      const nodeResult = await contents.debugger.sendCommand("DOM.querySelector", {
        nodeId: doc.root.nodeId,
        selector: `[data-cc-hub-upload="${markId}"]`,
      }) as { nodeId: number };
      if (!nodeResult.nodeId) {
        return { success: false, error: "无法通过 CDP 定位文件输入元素" };
      }
      await contents.debugger.sendCommand("DOM.setFileInputFiles", {
        files: [input.filePath],
        nodeId: nodeResult.nodeId,
      });
      // Clean up the marker attribute after file upload
      await contents.executeJavaScript(
        `(() => { const el = document.querySelector('[data-cc-hub-upload="${markId}"]'); if (el) el.removeAttribute('data-cc-hub-upload'); })()`,
        true,
      );
      return { success: true, path: input.filePath };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    } finally {
      if (!wasAttached) {
        try { contents.debugger.detach(); } catch { /* ignore */ }
      }
    }
  }

  listNetworkRequests(input: { pageSize?: number; pageIdx?: number; resourceTypes?: string[] }): { success: boolean; result?: BrowserWorkbenchNetworkLogResult; error?: string } {
    const limit = input.pageSize ?? MAX_NETWORK_LOGS;
    const offset = (input.pageIdx ?? 0) * limit;
    let entries = this.networkLogs;
    if (input.resourceTypes && input.resourceTypes.length > 0) {
      entries = entries.filter(e => input.resourceTypes!.includes(e.resourceType ?? ""));
    }
    const total = entries.length;
    const page = entries.slice(offset, offset + limit);
    return {
      success: true,
      result: {
        url: this.view?.webContents.getURL() ?? "",
        title: this.view?.webContents.getTitle(),
        captureEnabled: this.networkCaptureEnabled,
        captureError: this.networkCaptureError,
        count: total,
        entries: page,
      },
    };
  }

  async getNetworkRequest(reqid: number): Promise<{ success: boolean; result?: BrowserWorkbenchNetworkLog & { responseBody?: string; responseBodyBase64Encoded?: boolean; responseBodyTruncated?: boolean }; error?: string }> {
    const entry = this.networkLogs.find(e => e.id === String(reqid));
    if (!entry) {
      return { success: false, error: `未找到请求 ID ${reqid}` };
    }
    if (!entry.responseBody && !entry.bodyUnavailableReason) {
      try {
        const body = await this.getNetworkResponseBody(entry.id);
        if (body) {
          entry.responseBody = body.body;
          entry.responseBodyBase64Encoded = body.base64Encoded;
        }
      } catch {
        // Ignore body fetch errors
      }
    }
    return { success: true, result: entry };
  }

  listConsoleMessages(input: { pageSize?: number; pageIdx?: number; types?: string[] }): { success: boolean; result?: { url: string; title?: string; total: number; entries: BrowserWorkbenchConsoleLog[] }; error?: string } {
    const limit = input.pageSize ?? 300;
    const offset = (input.pageIdx ?? 0) * limit;
    let entries = this.logs;
    if (input.types && input.types.length > 0) {
      entries = entries.filter(e => input.types!.includes(e.level));
    }
    const total = entries.length;
    const page = entries.slice(offset, offset + limit);
    return {
      success: true,
      result: {
        url: this.view?.webContents.getURL() ?? "",
        title: this.view?.webContents.getTitle(),
        total,
        entries: page,
      },
    };
  }

  getConsoleMessage(msgid: number): { success: boolean; result?: BrowserWorkbenchConsoleLog; error?: string } {
    if (msgid < 0 || msgid >= this.logs.length) {
      return { success: false, error: `未找到控制台消息 ID ${msgid}` };
    }
    return { success: true, result: this.logs[msgid] };
  }

  async startPerformanceTrace(input?: { reload?: boolean; autoStop?: boolean }): Promise<{ success: boolean; state: BrowserWorkbenchState; error?: string }> {
    if (!this.view || this.view.webContents.isDestroyed()) {
      return { success: false, state: this.getState(), error: "浏览器工作台尚未打开页面。" };
    }
    const contents = this.view.webContents;
    try {
      if (!contents.debugger.isAttached()) {
        contents.debugger.attach();
      }
      const categories = [
        "-*",
        "devtools.timeline",
        "disabled-by-default-devtools.timeline",
        "disabled-by-default-devtools.timeline.frame",
        "disabled-by-default-devtools.timeline.stack",
        "v8.execute",
        "v8",
        "blink.console",
        "blink.user_timing",
        "disabled-by-default-devtools.screenshot",
        "loading",
      ];
      await contents.debugger.sendCommand("Tracing.start", {
        categories: categories.join(","),
        options: "record-as-much-as-possible",
      });
      if (input?.reload) {
        this.view.webContents.reload();
      }
      if (input?.autoStop !== false) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        return await this.stopPerformanceTrace();
      }
      return { success: true, state: this.getState() };
    } catch (error) {
      return { success: false, state: this.getState(), error: error instanceof Error ? error.message : String(error) };
    }
  }

  // Source: chrome-devtools-mcp/src/tools/performance.ts
  async stopPerformanceTrace(): Promise<{ success: boolean; state: BrowserWorkbenchState; error?: string; traceEvents?: unknown[] }> {
    if (!this.view || this.view.webContents.isDestroyed()) {
      return { success: false, state: this.getState(), error: "浏览器工作台尚未打开页面。" };
    }
    const contents = this.view.webContents;
    try {
      if (!contents.debugger.isAttached()) {
        return { success: false, state: this.getState(), error: "没有活跃的性能追踪" };
      }
      const result = await contents.debugger.sendCommand("Tracing.end") as unknown;
      const traceEvents = (result as Record<string, unknown>)?.traceEvents as unknown[];
      contents.debugger.detach();
      return { success: true, state: this.getState(), traceEvents };
    } catch (error) {
      return { success: false, state: this.getState(), error: error instanceof Error ? error.message : String(error) };
    }
  }

  async emulate(input: {
    networkConditions?: string;
    cpuThrottlingRate?: number;
    userAgent?: string;
    colorScheme?: "dark" | "light" | "auto";
    geolocation?: { latitude: number; longitude: number };
    viewport?: { width: number; height: number; deviceScaleFactor?: number; isMobile?: boolean; isLandscape?: boolean; hasTouch?: boolean };
  }): Promise<{ success: boolean; state: BrowserWorkbenchState; error?: string }> {
    if (!this.view || this.view.webContents.isDestroyed()) {
      return { success: false, state: this.getState(), error: "浏览器工作台尚未打开页面。" };
    }
    const contents = this.view.webContents;
    try {
      if (!contents.debugger.isAttached()) {
        contents.debugger.attach();
      }
      // Network conditions
      if (input.networkConditions) {
        const conditions: Record<string, unknown> = {};
        if (input.networkConditions === "Offline") {
          conditions.offline = true;
          conditions.latency = 0;
          conditions.downloadThroughput = 0;
          conditions.uploadThroughput = 0;
        } else {
          // 3G/4G presets
          conditions.offline = false;
          conditions.latency = input.networkConditions.includes("3G") ? 100 : 50;
          conditions.downloadThroughput = input.networkConditions.includes("Slow") ? 500 * 1024 : 5 * 1024 * 1024;
          conditions.uploadThroughput = input.networkConditions.includes("Slow") ? 500 * 1024 : 5 * 1024 * 1024;
        }
        await contents.debugger.sendCommand("Network.emulateNetworkConditions", conditions);
      }
      // CPU throttling
      if (input.cpuThrottlingRate) {
        await contents.debugger.sendCommand("Emulation.setCPUThrottlingRate", { rate: input.cpuThrottlingRate });
      }
      // User agent
      if (input.userAgent !== undefined) {
        await contents.debugger.sendCommand("Network.setUserAgentOverride", { userAgent: input.userAgent || "" });
      }
      // Color scheme — skip "auto" to restore system default
      if (input.colorScheme && input.colorScheme !== "auto") {
        await contents.debugger.sendCommand("Emulation.setEmulatedMedia", {
          features: [{ name: "prefers-color-scheme", value: input.colorScheme }],
        });
      }
      // Geolocation
      if (input.geolocation) {
        await contents.debugger.sendCommand("Emulation.setGeolocationOverride", {
          latitude: input.geolocation.latitude,
          longitude: input.geolocation.longitude,
          accuracy: 50,
        });
      }
      // Viewport
      if (input.viewport) {
        const bounds = this.view.getBounds();
        const w = input.viewport.width || bounds.width;
        const h = input.viewport.height || bounds.height;
        this.view.setBounds({ ...bounds, width: w, height: h });
        await contents.debugger.sendCommand("Emulation.setDeviceMetricsOverride", {
          width: w,
          height: h,
          deviceScaleFactor: input.viewport.deviceScaleFactor || 1,
          mobile: input.viewport.isMobile || false,
          screenOrientation: input.viewport.isLandscape
            ? { type: "landscapePrimary", angle: 90 }
            : { type: "portraitPrimary", angle: 0 },
          screen: input.viewport.hasTouch !== undefined
            ? { hasTouch: input.viewport.hasTouch }
            : undefined,
        });
      }
      return { success: true, state: this.getState() };
    } catch (error) {
      return { success: false, state: this.getState(), error: error instanceof Error ? error.message : String(error) };
    }
  }

  listPages(): { success: boolean; pages?: Array<{ pageId: number; url: string; title?: string }>; error?: string } {
    if (!this.view || this.view.webContents.isDestroyed()) {
      return { success: true, pages: [] };
    }
    return {
      success: true,
      pages: [{
        pageId: 0,
        url: this.view.webContents.getURL(),
        title: this.view.webContents.getTitle(),
      }],
    };
  }

  selectPage(pageId: number): BrowserWorkbenchState {
    void pageId;
    // Single BrowserView: page selection is identity
    return this.getState();
  }

  async newPage(input: { url: string; background?: boolean }): Promise<BrowserWorkbenchState> {
    // Open the URL in the current BrowserView
    this.open(input.url);
    return this.getState();
  }

  // Source: chrome-devtools-mcp/src/tools/script.ts
  async evaluateScriptEnhanced(input: {
    function: string;
    args?: string[];
  }): Promise<{ success: boolean; result?: BrowserWorkbenchEvalResult & { output?: string }; error?: string }> {
    if (!this.view || this.view.webContents.isDestroyed()) {
      return { success: false, error: "浏览器工作台尚未打开页面。" };
    }
    try {
      let fnString = input.function;
      if (input.args && input.args.length > 0) {
        // Serialize args: try JSON.parse first (number/boolean/object),
        // fall back to JSON.stringify (plain string)
        const serializedArgs = input.args.map(a => {
          try { JSON.parse(a); return a; } catch { return JSON.stringify(a); }
        });
        fnString = `(async () => {
          const fn = (${input.function});
          return await fn(...[${serializedArgs.join(", ")}]);
        })`;
      }
      const value = await this.view.webContents.executeJavaScript(fnString, true) as unknown;
      const result: BrowserWorkbenchEvalResult & { output?: string } = {
        url: this.view.webContents.getURL(),
        title: this.view.webContents.getTitle(),
        success: true,
        value,
        output: typeof value === "string" ? value : JSON.stringify(value),
      };
      return { success: true, result };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      const result: BrowserWorkbenchEvalResult & { output?: string } = {
        url: this.view?.webContents.getURL() ?? "",
        title: this.view?.webContents.getTitle(),
        success: false,
        error: errMsg,
        output: undefined,
      };
      return { success: false, result, error: errMsg };
    }
  }

  private ensureView(): BrowserView {
    if (this.view && !this.view.webContents.isDestroyed()) {
      this.window.setBrowserView(this.view);
      this.view.setBounds(this.bounds);
      this.ensureNetworkCapture(this.view);
      return this.view;
    }

    const view = new BrowserView({
      webPreferences: buildBrowserWorkbenchWebPreferences(getBrowserWorkbenchPreloadPath()),
    });

    this.view = view;
    this.window.setBrowserView(view);
    view.setBounds(this.bounds);
    view.setAutoResize({ width: false, height: false });
    view.webContents.setWindowOpenHandler(({ url }) => {
      if (url) {
        void this.syncChromeCookies(url).then(() => {
          if (!view.webContents.isDestroyed()) {
            view.webContents.loadURL(url);
          }
        });
      }
      return { action: "deny" };
    });

    this.ensureNetworkCapture(view);
    view.webContents.on("did-start-loading", () => this.emitState());
    view.webContents.on("did-stop-loading", () => this.emitState());
    view.webContents.on("page-title-updated", () => this.emitState());
    view.webContents.on("did-start-navigation", (_event, _url, isInPlace, isMainFrame) => {
      if (isMainFrame && !isInPlace) {
        this.clearNetworkLogs();
      }
    });
    view.webContents.on("did-navigate", (_event, url) => {
      this.recordNavigation(url);
      this.emitState();
    });
    view.webContents.on("did-navigate-in-page", (_event, url, isMainFrame) => {
      if (isMainFrame) this.recordNavigation(url);
      this.emitState();
    });
    view.webContents.on("did-finish-load", () => {
      if (this.annotationMode) {
        void this.installAnnotationScript();
      }
      if (this.recordingSession || this.recordingLocatorPickActionId) {
        void this.installRecordingScript();
      }
      this.emitState();
    });
    view.webContents.on("console-message", (_event, level, message, line, sourceId) => {
      this.handleConsoleMessage(level, message, line, sourceId);
    });
    view.webContents.on("ipc-message", (_event, channel, raw) => {
      if (channel === BROWSER_WORKBENCH_ANNOTATION_CHANNEL && typeof raw === "string") {
        this.handleAnnotationMessage(raw);
      }
      if (channel === BROWSER_WORKBENCH_RECORDER_CHANNEL && typeof raw === "string") {
        this.handleRecordingMessage(raw);
      }
    });

    return view;
  }

  private ensureNetworkCapture(view: BrowserView): void {
    const contents = view.webContents;
    if (contents.isDestroyed()) return;

    const client = contents.debugger;
    if (!this.networkListenerContentIds.has(contents.id)) {
      this.networkListenerContentIds.add(contents.id);
      client.on("message", (_event, method, params) => {
        this.handleNetworkDebuggerMessage(contents, method, params);
      });
      client.on("detach", (_event, reason) => {
        this.networkCaptureEnabled = false;
        this.networkCaptureError = reason ? String(reason) : "debugger detached";
      });
    }

    if (client.isAttached()) {
      this.networkCaptureEnabled = true;
      this.networkCaptureError = undefined;
      void client.sendCommand("Network.enable", {
        maxResourceBufferSize: 1024 * 1024,
        maxTotalBufferSize: 10 * 1024 * 1024,
      }).catch((error) => {
        this.networkCaptureEnabled = false;
        this.networkCaptureError = error instanceof Error ? error.message : String(error);
      });
      return;
    }

    try {
      client.attach("1.3");
      this.networkCaptureEnabled = true;
      this.networkCaptureError = undefined;
      void client.sendCommand("Network.enable", {
        maxResourceBufferSize: 1024 * 1024,
        maxTotalBufferSize: 10 * 1024 * 1024,
      }).catch((error) => {
        this.networkCaptureEnabled = false;
        this.networkCaptureError = error instanceof Error ? error.message : String(error);
      });
    } catch (error) {
      this.networkCaptureEnabled = false;
      this.networkCaptureError = error instanceof Error ? error.message : String(error);
    }
  }

  private handleNetworkDebuggerMessage(contents: WebContents, method: string, params: unknown): void {
    const payload = readCdpObject(params);
    const requestId = readCdpString(payload.requestId);
    if (!requestId) return;

    if (method === "Network.requestWillBeSent") {
      const request = readCdpObject(payload.request);
      const postData = truncateNetworkText(readCdpString(request.postData));
      const entry: BrowserWorkbenchNetworkLog = this.networkLogsByRequestId.get(requestId) ?? {
        id: requestId,
        url: readCdpString(request.url) ?? "",
        startedAt: networkStartedAt(payload),
      };
      entry.url = readCdpString(request.url) ?? entry.url;
      entry.method = readCdpString(request.method) ?? entry.method;
      entry.resourceType = readCdpString(payload.type) ?? entry.resourceType;
      entry.requestHeaders = normalizeNetworkHeaders(request.headers);
      entry.requestPostData = postData.value;
      entry.requestPostDataTruncated = postData.truncated;
      this.rememberNetworkLog(requestId, entry);
      return;
    }

    if (method === "Network.responseReceived") {
      const response = readCdpObject(payload.response);
      const entry = this.networkLogsByRequestId.get(requestId);
      if (!entry) return;
      entry.resourceType = readCdpString(payload.type) ?? entry.resourceType;
      entry.status = readCdpNumber(response.status);
      entry.statusText = readCdpString(response.statusText);
      entry.mimeType = readCdpString(response.mimeType);
      entry.responseHeaders = normalizeNetworkHeaders(response.headers);
      entry.fromDiskCache = Boolean(response.fromDiskCache);
      entry.fromServiceWorker = Boolean(response.fromServiceWorker);
      return;
    }

    if (method === "Network.loadingFinished") {
      const entry = this.networkLogsByRequestId.get(requestId);
      if (!entry) return;
      entry.finishedAt = Date.now();
      entry.durationMs = Math.max(0, entry.finishedAt - entry.startedAt);
      if (this.shouldCaptureNetworkBody(entry)) {
        void this.captureNetworkResponseBody(contents, requestId, entry);
      }
      return;
    }

    if (method === "Network.loadingFailed") {
      const entry = this.networkLogsByRequestId.get(requestId);
      if (!entry) return;
      entry.finishedAt = Date.now();
      entry.durationMs = Math.max(0, entry.finishedAt - entry.startedAt);
      entry.errorText = readCdpString(payload.errorText) ?? "loading failed";
    }
  }

  private rememberNetworkLog(requestId: string, entry: BrowserWorkbenchNetworkLog): void {
    if (!this.networkLogsByRequestId.has(requestId)) {
      this.networkLogs.push(entry);
    }
    this.networkLogsByRequestId.set(requestId, entry);
    while (this.networkLogs.length > MAX_NETWORK_LOGS) {
      const removed = this.networkLogs.shift();
      if (removed) {
        this.networkLogsByRequestId.delete(removed.id);
      }
    }
  }

  private shouldCaptureNetworkBody(entry: BrowserWorkbenchNetworkLog): boolean {
    const resourceType = (entry.resourceType ?? "").toLowerCase();
    if (resourceType !== "fetch" && resourceType !== "xhr") {
      return false;
    }
    const mimeType = (entry.mimeType ?? "").toLowerCase();
    if (!mimeType) return true;
    return (
      mimeType.startsWith("text/") ||
      mimeType.includes("json") ||
      mimeType.includes("xml") ||
      mimeType.includes("javascript") ||
      mimeType.includes("x-www-form-urlencoded") ||
      mimeType.includes("graphql")
    );
  }

  private async captureNetworkResponseBody(contents: WebContents, requestId: string, entry: BrowserWorkbenchNetworkLog): Promise<void> {
    if (contents.isDestroyed() || !contents.debugger.isAttached()) {
      entry.bodyUnavailableReason = "debugger detached";
      return;
    }
    try {
      const bodyResult = await contents.debugger.sendCommand("Network.getResponseBody", { requestId }) as unknown;
      const bodyPayload = readCdpObject(bodyResult);
      const bodyText = truncateNetworkText(readCdpString(bodyPayload.body));
      entry.responseBody = bodyText.value;
      entry.responseBodyTruncated = bodyText.truncated;
      entry.responseBodyBase64Encoded = Boolean(bodyPayload.base64Encoded);
    } catch (error) {
      entry.bodyUnavailableReason = error instanceof Error ? error.message : String(error);
    }
  }

  private async getNetworkResponseBody(requestId: string): Promise<{ body: string; base64Encoded: boolean } | null> {
    if (!this.view || this.view.webContents.isDestroyed() || !this.view.webContents.debugger.isAttached()) {
      return null;
    }
    try {
      const bodyResult = await this.view.webContents.debugger.sendCommand("Network.getResponseBody", { requestId }) as unknown;
      const bodyPayload = readCdpObject(bodyResult);
      const bodyText = truncateNetworkText(readCdpString(bodyPayload.body));
      return { body: bodyText.value ?? "", base64Encoded: Boolean(bodyPayload.base64Encoded) };
    } catch {
      return null;
    }
  }

  private clearNetworkLogs(): void {
    this.networkLogs = [];
    this.networkLogsByRequestId.clear();
  }

  private handleConsoleMessage(level: unknown, message: string, line?: number, sourceId?: string): void {
    if (message.startsWith(ANNOTATION_PREFIX)) {
      this.handleAnnotationMessage(message.slice(ANNOTATION_PREFIX.length));
      return;
    }
    if (message.startsWith(RECORDER_PREFIX)) {
      this.handleRecordingMessage(message.slice(RECORDER_PREFIX.length));
      return;
    }

    const log: BrowserWorkbenchConsoleLog = {
      level: toLogLevel(level),
      message,
      timestamp: Date.now(),
      url: sourceId,
      line,
    };
    this.logs.push(log);
    this.logs = this.logs.slice(-300);
    this.emit({ type: "browser.console", payload: log });
  }

  private handleAnnotationMessage(raw: string): void {
    try {
      const parsed = JSON.parse(raw) as Partial<BrowserWorkbenchAnnotation>;
      this.emit({
        type: "browser.annotation",
        payload: {
          ...parsed,
          id: parsed.id || crypto.randomUUID(),
          url: parsed.url || this.view?.webContents.getURL() || "",
          title: parsed.title || this.view?.webContents.getTitle(),
          createdAt: parsed.createdAt || Date.now(),
          point: parsed.point || { x: 0, y: 0 },
        } as BrowserWorkbenchAnnotation,
      });
    } catch {
      // Ignore malformed marker payloads from pages.
    }
  }

  private handleRecordingMessage(raw: string): void {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && (parsed as { kind?: unknown }).kind === "__repairLocator") {
        void this.handleRecordingLocatorPickMessage(parsed as Record<string, unknown>);
        return;
      }
      if (!this.recordingSession) return;
      const action = appendBrowserWorkbenchRecordedAction(this.recordingSession, parsed);
      if (action) {
        this.emit({ type: "browser.recording", payload: this.getRecordingState() });
      }
    } catch {
      // Ignore malformed recording payloads from pages.
    }
  }

  private async handleRecordingLocatorPickMessage(payload: Record<string, unknown>): Promise<void> {
    const actionId = typeof payload.actionId === "string" ? payload.actionId : this.recordingLocatorPickActionId;
    const rawTarget = payload.target && typeof payload.target === "object" ? payload.target as Record<string, unknown> : {};
    const selector = typeof rawTarget.selector === "string" ? rawTarget.selector : "";
    if (!actionId || !selector) {
      this.recordingLocatorPickActionId = undefined;
      this.emit({ type: "browser.recording", payload: this.getRecordingState() });
      return;
    }
    await this.repairRecordingLocator({ actionId, selector });
    if (!this.recordingSession) {
      await this.uninstallRecordingScript();
    }
  }

  private recordNavigation(url?: string): void {
    if (!this.recordingSession) return;
    const action = appendBrowserWorkbenchRecordedAction(this.recordingSession, {
      kind: "navigate",
      source: "navigation",
      url: url || this.view?.webContents.getURL() || "",
      title: this.view?.webContents.getTitle(),
      timestamp: Date.now(),
    });
    if (action) {
      this.emit({ type: "browser.recording", payload: this.getRecordingState() });
    }
  }

  private emitState(): void {
    this.emit({ type: "browser.state", payload: this.getState() });
  }

  private emit(event: BrowserWorkbenchEvent): void {
    if (this.window.isDestroyed()) return;
    const scopedEvent = this.sessionId ? { ...event, sessionId: this.sessionId } : event;
    this.window.webContents.send("browser-event", JSON.stringify(scopedEvent));
    for (const listener of this.listeners) {
      listener(scopedEvent);
    }
  }

  private async installAnnotationScript(): Promise<void> {
    if (!this.view || this.view.webContents.isDestroyed()) return;
    try {
      await this.view.webContents.executeJavaScript(
        `(${this.buildAnnotationScript()})(${JSON.stringify({ enabled: this.annotationMode, prefix: ANNOTATION_PREFIX })})`,
        true,
      );
    } catch (error) {
      this.handleConsoleMessage(
        "warn",
        `[browser-workbench] annotation injection failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Cross-origin frames or transient navigations can reject injection. The
      // next completed load will retry if annotation mode is still enabled.
    }
  }

  private async installRecordingScript(): Promise<void> {
    if (!this.view || this.view.webContents.isDestroyed() || (!this.recordingSession && !this.recordingLocatorPickActionId)) return;
    try {
      await this.view.webContents.executeJavaScript(
        `(${buildBrowserWorkbenchRecorderInjectionScript()})(${JSON.stringify({
          enabled: true,
          assertionMode: this.recordingAssertionMode,
          locatorPickActionId: this.recordingLocatorPickActionId,
          recorderPrefix: RECORDER_PREFIX,
        })})`,
        true,
      );
    } catch (error) {
      this.handleConsoleMessage(
        "warn",
        `[browser-workbench] recorder injection failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async uninstallRecordingScript(): Promise<void> {
    if (!this.view || this.view.webContents.isDestroyed()) return;
    try {
      await this.view.webContents.executeJavaScript(
        `(() => { if (typeof window.__techCcHubRecorderCleanup === "function") window.__techCcHubRecorderCleanup(); return true; })()`,
        true,
      );
    } catch {
      // The page may have navigated while stopping the recorder.
    }
  }

  private buildDomStatsScript(): string {
    return `function() {
      const elements = Array.from(document.querySelectorAll("*"));
      const tagCounts = new Map();
      elements.forEach((element) => {
        const tagName = (element.tagName || "").toLowerCase();
        if (!tagName) return;
        tagCounts.set(tagName, (tagCounts.get(tagName) || 0) + 1);
      });

      return {
        url: location.href,
        title: document.title,
        totalElements: elements.length,
        interactiveCounts: {
          links: document.querySelectorAll("a[href]").length,
          buttons: document.querySelectorAll("button").length,
          inputs: document.querySelectorAll("input").length,
          selects: document.querySelectorAll("select").length,
          textareas: document.querySelectorAll("textarea").length,
          forms: document.querySelectorAll("form").length,
          images: document.querySelectorAll("img").length,
          scripts: document.querySelectorAll("script").length,
          stylesheets: document.querySelectorAll('link[rel~="stylesheet"],style').length,
          iframes: document.querySelectorAll("iframe").length,
        },
        topTags: Array.from(tagCounts.entries())
          .sort((left, right) => right[1] - left[1])
          .slice(0, 24)
          .map(([tagName, count]) => ({ tagName, count })),
      };
    }`;
  }

  private buildQueryNodesScript(): string {
    return `function(input) {
      const strategy = input && input.strategy === "xpath" ? "xpath" : "selector";
      const query = typeof input.query === "string" ? input.query.trim() : "";
      const maxResults = Math.max(1, Math.min(Number.isFinite(input.maxResults) ? Math.trunc(input.maxResults) : 8, 50));
      const includeStyles = Boolean(input.includeStyles);
      const styleProps = Array.isArray(input.styleProps) ? input.styleProps.filter((item) => typeof item === "string" && item.trim()).slice(0, 40) : [];

      function buildPath(element) {
        const parts = [];
        let current = element;
        while (current && current.nodeType === Node.ELEMENT_NODE) {
          const parent = current.parentElement;
          const tag = current.tagName.toLowerCase();
          const index = parent ? Array.prototype.indexOf.call(parent.children, current) + 1 : 1;
          parts.unshift(tag + ":nth-of-type(" + index + ")");
          current = parent;
        }
        return parts.join(" > ");
      }

      function buildSelector(element) {
        if (!element || element.nodeType !== Node.ELEMENT_NODE) return undefined;
        if (element.id) return element.tagName.toLowerCase() + "#" + element.id;
        const classList = Array.from(element.classList || []).slice(0, 3).join(".");
        if (classList) return element.tagName.toLowerCase() + "." + classList;
        return element.tagName.toLowerCase();
      }

      function buildXPath(element) {
        if (!element || element.nodeType !== Node.ELEMENT_NODE) return undefined;
        const parts = [];
        let current = element;
        while (current && current.nodeType === Node.ELEMENT_NODE) {
          let index = 1;
          let sibling = current.previousElementSibling;
          while (sibling) {
            if (sibling.tagName === current.tagName) index += 1;
            sibling = sibling.previousElementSibling;
          }
          parts.unshift(current.tagName.toLowerCase() + "[" + index + "]");
          current = current.parentElement;
        }
        return "/" + parts.join("/");
      }

      function getAttributes(element) {
        return Array.from(element.attributes || []).slice(0, 24).reduce((accumulator, attribute) => {
          accumulator[attribute.name] = attribute.value;
          return accumulator;
        }, {});
      }

      function getBoundingBox(element) {
        const rect = element.getBoundingClientRect();
        return {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      }

      function getComputedStyleSubset(element) {
        if (!includeStyles) return undefined;
        const computed = window.getComputedStyle(element);
        const properties = styleProps.length > 0 ? styleProps : [
          "display",
          "position",
          "width",
          "height",
          "color",
          "background-color",
          "font-size",
          "font-weight",
          "opacity",
          "visibility",
          "pointer-events",
        ];
        return properties.reduce((accumulator, property) => {
          accumulator[property] = computed.getPropertyValue(property);
          return accumulator;
        }, {});
      }

      function toNodeSnapshot(element, index) {
        return {
          index,
          tagName: element.tagName.toLowerCase(),
          id: element.id || undefined,
          className: typeof element.className === "string" ? element.className : undefined,
          text: (element.innerText || element.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 240) || undefined,
          selector: buildSelector(element),
          path: buildPath(element),
          xpath: buildXPath(element),
          htmlSnippet: element.outerHTML ? element.outerHTML.slice(0, 400) : undefined,
          attributes: getAttributes(element),
          boundingBox: getBoundingBox(element),
          computedStyle: getComputedStyleSubset(element),
        };
      }

      function findNodes() {
        if (!query) return [];
        if (strategy === "xpath") {
          const result = document.evaluate(query, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
          const matches = [];
          for (let index = 0; index < result.snapshotLength; index += 1) {
            const item = result.snapshotItem(index);
            if (item && item.nodeType === Node.ELEMENT_NODE) {
              matches.push(item);
            }
          }
          return matches;
        }
        return Array.from(document.querySelectorAll(query));
      }

      const allMatches = findNodes();
      const limitedMatches = allMatches.slice(0, maxResults).map((element, index) => toNodeSnapshot(element, index));

      return {
        url: location.href,
        title: document.title,
        strategy,
        query,
        total: allMatches.length,
        returned: limitedMatches.length,
        matches: limitedMatches,
      };
    }`;
  }

  private buildInteractiveSnapshotScript(): string {
    return `function(input) {
      const maxResults = Math.max(1, Math.min(Number.isFinite(input && input.maxResults) ? Math.trunc(input.maxResults) : 80, 200));
      const visibleOnly = input && Object.prototype.hasOwnProperty.call(input, "visibleOnly") ? Boolean(input.visibleOnly) : true;
      const selector = [
        "a[href]",
        "button",
        "input",
        "textarea",
        "select",
        "summary",
        "[role='button']",
        "[role='link']",
        "[role='checkbox']",
        "[role='menuitem']",
        "[role='option']",
        "[role='tab']",
        "[role='textbox']",
        "[contenteditable='true']",
        "[tabindex]:not([tabindex='-1'])",
      ].join(",");

      function isVisible(element) {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none" && Number(style.opacity || "1") > 0;
      }

      function buildPath(element) {
        const parts = [];
        let current = element;
        while (current && current.nodeType === Node.ELEMENT_NODE) {
          const parent = current.parentElement;
          const tag = current.tagName.toLowerCase();
          const nth = parent ? Array.prototype.indexOf.call(parent.children, current) + 1 : 1;
          parts.unshift(tag + ":nth-of-type(" + nth + ")");
          current = parent;
        }
        return parts.join(" > ");
      }

      function buildSelector(element) {
        if (!element || element.nodeType !== Node.ELEMENT_NODE) return undefined;
        if (element.id) return element.tagName.toLowerCase() + "#" + CSS.escape(element.id);
        const dataTestId = element.getAttribute("data-testid") || element.getAttribute("data-test");
        if (dataTestId) return element.tagName.toLowerCase() + "[data-testid='" + CSS.escape(dataTestId) + "']";
        return buildPath(element);
      }

      function buildXPath(element) {
        const parts = [];
        let current = element;
        while (current && current.nodeType === Node.ELEMENT_NODE) {
          let nth = 1;
          let sibling = current.previousElementSibling;
          while (sibling) {
            if (sibling.tagName === current.tagName) nth += 1;
            sibling = sibling.previousElementSibling;
          }
          parts.unshift(current.tagName.toLowerCase() + "[" + nth + "]");
          current = current.parentElement;
        }
        return "/" + parts.join("/");
      }

      function getName(element) {
        return (
          element.getAttribute("aria-label") ||
          element.getAttribute("alt") ||
          element.getAttribute("title") ||
          element.getAttribute("placeholder") ||
          element.value ||
          element.innerText ||
          element.textContent ||
          element.getAttribute("href") ||
          ""
        ).replace(/\\s+/g, " ").trim().slice(0, 160) || undefined;
      }

      function toElement(element, index) {
        const rect = element.getBoundingClientRect();
        const ref = "e" + (index + 1);
        const item = {
          ref,
          tagName: element.tagName.toLowerCase(),
          role: element.getAttribute("role") || undefined,
          name: getName(element),
          type: element.getAttribute("type") || undefined,
          text: (element.innerText || element.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 160) || undefined,
          value: typeof element.value === "string" ? element.value.slice(0, 160) : undefined,
          href: element.href || element.getAttribute("href") || undefined,
          selector: buildSelector(element),
          xpath: buildXPath(element),
          disabled: Boolean(element.disabled || element.getAttribute("aria-disabled") === "true"),
          boundingBox: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          },
        };
        return item;
      }

      const all = Array.from(document.querySelectorAll(selector))
        .filter((element) => element instanceof HTMLElement || element instanceof SVGElement)
        .filter((element) => !visibleOnly || isVisible(element));
      const elements = all.slice(0, maxResults).map(toElement);
      window.__techCcHubBrowserRefs = elements.reduce((accumulator, element) => {
        accumulator[element.ref] = { selector: element.selector, xpath: element.xpath };
        return accumulator;
      }, {});
      return {
        url: location.href,
        title: document.title,
        total: all.length,
        returned: elements.length,
        elements,
      };
    }`;
  }

  private buildElementActionScript(): string {
    return `function(input) {
      const action = input && ["click", "dblclick", "focus", "hover", "type", "fill", "select", "check", "uncheck", "scrollIntoView"].includes(input.action) ? input.action : "click";
      const rawTarget = typeof input.target === "string" ? input.target.trim() : "";
      const index = Math.max(0, Number.isFinite(input.index) ? Math.trunc(input.index) : 0);
      const requestedStrategy = input.strategy === "ref" || input.strategy === "selector" || input.strategy === "xpath" ? input.strategy : "auto";

      function resolveXPath(xpath) {
        const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        return result.snapshotItem(index);
      }

      function resolveTarget() {
        if (!rawTarget) return { strategy: "selector", element: null, error: "target 不能为空。" };
        const refName = rawTarget.startsWith("@") ? rawTarget.slice(1) : rawTarget;
        if ((requestedStrategy === "ref" || requestedStrategy === "auto") && /^e\\d+$/.test(refName)) {
          const refs = window.__techCcHubBrowserRefs || {};
          const cached = refs[refName];
          if (!cached) return { strategy: "ref", element: null, error: "未找到 ref，请先调用 browser_snapshot_interactive 刷新快照。" };
          const byXPath = cached.xpath ? resolveXPath(cached.xpath) : null;
          const bySelector = !byXPath && cached.selector ? document.querySelector(cached.selector) : null;
          return { strategy: "ref", element: byXPath || bySelector, error: byXPath || bySelector ? undefined : "ref 指向的元素已不存在。" };
        }
        if (requestedStrategy === "xpath" || (requestedStrategy === "auto" && rawTarget.startsWith("/"))) {
          return { strategy: "xpath", element: resolveXPath(rawTarget) };
        }
        try {
          return { strategy: "selector", element: document.querySelectorAll(rawTarget)[index] || null };
        } catch (error) {
          return { strategy: "selector", element: null, error: error instanceof Error ? error.message : String(error) };
        }
      }

      function buildXPath(element) {
        const parts = [];
        let current = element;
        while (current && current.nodeType === Node.ELEMENT_NODE) {
          let nth = 1;
          let sibling = current.previousElementSibling;
          while (sibling) {
            if (sibling.tagName === current.tagName) nth += 1;
            sibling = sibling.previousElementSibling;
          }
          parts.unshift(current.tagName.toLowerCase() + "[" + nth + "]");
          current = current.parentElement;
        }
        return "/" + parts.join("/");
      }

      function buildPath(element) {
        const parts = [];
        let current = element;
        while (current && current.nodeType === Node.ELEMENT_NODE) {
          const parent = current.parentElement;
          const tag = current.tagName.toLowerCase();
          const nth = parent ? Array.prototype.indexOf.call(parent.children, current) + 1 : 1;
          parts.unshift(tag + ":nth-of-type(" + nth + ")");
          current = parent;
        }
        return parts.join(" > ");
      }

      function nodeSnapshot(element) {
        const rect = element.getBoundingClientRect();
        return {
          ref: "",
          tagName: element.tagName.toLowerCase(),
          role: element.getAttribute("role") || undefined,
          name: (element.getAttribute("aria-label") || element.getAttribute("placeholder") || element.innerText || element.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 160) || undefined,
          type: element.getAttribute("type") || undefined,
          text: (element.innerText || element.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 160) || undefined,
          value: typeof element.value === "string" ? element.value.slice(0, 160) : undefined,
          href: element.href || element.getAttribute("href") || undefined,
          selector: element.id ? element.tagName.toLowerCase() + "#" + CSS.escape(element.id) : buildPath(element),
          xpath: buildXPath(element),
          disabled: Boolean(element.disabled || element.getAttribute("aria-disabled") === "true"),
          boundingBox: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          },
        };
      }

      const resolved = resolveTarget();
      if (!resolved.element || resolved.element.nodeType !== Node.ELEMENT_NODE) {
        return {
          url: location.href,
          title: document.title,
          action,
          target: rawTarget,
          strategy: resolved.strategy,
          found: false,
          error: resolved.error || "未找到目标元素。",
        };
      }

      const element = resolved.element;
      element.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
      if (typeof element.focus === "function") element.focus({ preventScroll: true });
      if (action === "fill" || action === "type") {
        const value = typeof input.value === "string" ? input.value : "";
        if ("value" in element) {
          element.value = action === "type" ? String(element.value || "") + value : value;
          element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
          element.dispatchEvent(new Event("change", { bubbles: true }));
        } else if (element.isContentEditable) {
          element.textContent = action === "type" ? (element.textContent || "") + value : value;
          element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
        } else {
          return {
            url: location.href,
            title: document.title,
            action,
            target: rawTarget,
            strategy: resolved.strategy,
            found: true,
            error: "目标元素不可填写或输入。",
            node: nodeSnapshot(element),
          };
        }
      } else if (action === "select") {
        const value = typeof input.value === "string" ? input.value : "";
        if (element.tagName.toLowerCase() !== "select") {
          return {
            url: location.href,
            title: document.title,
            action,
            target: rawTarget,
            strategy: resolved.strategy,
            found: true,
            error: "目标元素不是 select。",
            node: nodeSnapshot(element),
          };
        }
        element.value = value;
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
      } else if (action === "check" || action === "uncheck") {
        const shouldCheck = action === "check";
        const isCheckable = element instanceof HTMLInputElement && ["checkbox", "radio"].includes(element.type);
        if (isCheckable) {
          if (element.checked !== shouldCheck) element.click();
        } else if (element.getAttribute("role") === "checkbox") {
          const checked = element.getAttribute("aria-checked") === "true";
          if (checked !== shouldCheck) element.click();
        } else {
          return {
            url: location.href,
            title: document.title,
            action,
            target: rawTarget,
            strategy: resolved.strategy,
            found: true,
            error: "目标元素不是 checkbox/radio/role=checkbox。",
            node: nodeSnapshot(element),
          };
        }
      } else if (action === "focus") {
        if (typeof element.focus === "function") element.focus({ preventScroll: true });
      } else if (action === "hover") {
        const rect = element.getBoundingClientRect();
        const eventInit = { bubbles: true, cancelable: true, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 };
        element.dispatchEvent(new MouseEvent("mouseover", eventInit));
        element.dispatchEvent(new MouseEvent("mouseenter", eventInit));
        element.dispatchEvent(new MouseEvent("mousemove", eventInit));
      } else if (action === "dblclick") {
        element.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true, detail: 2 }));
      } else if (action === "scrollIntoView") {
        element.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
      } else {
        element.click();
      }

      return {
        url: location.href,
        title: document.title,
        action,
        target: rawTarget,
        strategy: resolved.strategy,
        found: true,
        value: typeof input.value === "string" ? input.value : undefined,
        node: nodeSnapshot(element),
      };
    }`;
  }

  private buildElementInfoScript(): string {
    return `function(input) {
      const kind = input && ["text", "html", "value", "attr", "title", "url", "count", "box", "styles"].includes(input.kind) ? input.kind : "text";
      const rawTarget = typeof input.target === "string" ? input.target.trim() : "";
      const index = Math.max(0, Number.isFinite(input.index) ? Math.trunc(input.index) : 0);
      const requestedStrategy = input.strategy === "ref" || input.strategy === "selector" || input.strategy === "xpath" ? input.strategy : "auto";

      function resolveXPath(xpath, countOnly) {
        const resultType = countOnly ? XPathResult.ORDERED_NODE_SNAPSHOT_TYPE : XPathResult.ORDERED_NODE_SNAPSHOT_TYPE;
        const result = document.evaluate(xpath, document, null, resultType, null);
        return countOnly ? result.snapshotLength : result.snapshotItem(index);
      }

      function resolveTarget(countOnly) {
        if (kind === "title" || kind === "url") return { strategy: "selector", element: document.documentElement, count: 1 };
        if (!rawTarget) return { strategy: "selector", element: null, count: 0, error: "target 不能为空。" };
        const refName = rawTarget.startsWith("@") ? rawTarget.slice(1) : rawTarget;
        if ((requestedStrategy === "ref" || requestedStrategy === "auto") && /^e\\d+$/.test(refName)) {
          const refs = window.__techCcHubBrowserRefs || {};
          const cached = refs[refName];
          if (!cached) return { strategy: "ref", element: null, count: 0, error: "未找到 ref，请先调用 browser_snapshot_interactive 刷新快照。" };
          const element = cached.xpath ? resolveXPath(cached.xpath, false) : document.querySelector(cached.selector);
          return { strategy: "ref", element, count: element ? 1 : 0, error: element ? undefined : "ref 指向的元素已不存在。" };
        }
        if (requestedStrategy === "xpath" || (requestedStrategy === "auto" && rawTarget.startsWith("/"))) {
          return { strategy: "xpath", element: countOnly ? null : resolveXPath(rawTarget, false), count: resolveXPath(rawTarget, true) };
        }
        try {
          const nodes = document.querySelectorAll(rawTarget);
          return { strategy: "selector", element: nodes[index] || null, count: nodes.length };
        } catch (error) {
          return { strategy: "selector", element: null, count: 0, error: error instanceof Error ? error.message : String(error) };
        }
      }

      function buildXPath(element) {
        const parts = [];
        let current = element;
        while (current && current.nodeType === Node.ELEMENT_NODE) {
          let nth = 1;
          let sibling = current.previousElementSibling;
          while (sibling) {
            if (sibling.tagName === current.tagName) nth += 1;
            sibling = sibling.previousElementSibling;
          }
          parts.unshift(current.tagName.toLowerCase() + "[" + nth + "]");
          current = current.parentElement;
        }
        return "/" + parts.join("/");
      }

      function buildPath(element) {
        const parts = [];
        let current = element;
        while (current && current.nodeType === Node.ELEMENT_NODE) {
          const parent = current.parentElement;
          const tag = current.tagName.toLowerCase();
          const nth = parent ? Array.prototype.indexOf.call(parent.children, current) + 1 : 1;
          parts.unshift(tag + ":nth-of-type(" + nth + ")");
          current = parent;
        }
        return parts.join(" > ");
      }

      function nodeSnapshot(element) {
        const rect = element.getBoundingClientRect();
        return {
          ref: "",
          tagName: element.tagName.toLowerCase(),
          role: element.getAttribute("role") || undefined,
          name: (element.getAttribute("aria-label") || element.getAttribute("placeholder") || element.innerText || element.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 160) || undefined,
          type: element.getAttribute("type") || undefined,
          text: (element.innerText || element.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 160) || undefined,
          value: typeof element.value === "string" ? element.value.slice(0, 160) : undefined,
          href: element.href || element.getAttribute("href") || undefined,
          selector: element.id ? element.tagName.toLowerCase() + "#" + CSS.escape(element.id) : buildPath(element),
          xpath: buildXPath(element),
          disabled: Boolean(element.disabled || element.getAttribute("aria-disabled") === "true"),
          boundingBox: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          },
        };
      }

      if (kind === "title") {
        return { url: location.href, title: document.title, kind, found: true, value: document.title };
      }
      if (kind === "url") {
        return { url: location.href, title: document.title, kind, found: true, value: location.href };
      }

      const resolved = resolveTarget(kind === "count");
      if (kind === "count") {
        return { url: location.href, title: document.title, kind, target: rawTarget, strategy: resolved.strategy, found: true, count: resolved.count, value: resolved.count };
      }
      if (!resolved.element || resolved.element.nodeType !== Node.ELEMENT_NODE) {
        return { url: location.href, title: document.title, kind, target: rawTarget, strategy: resolved.strategy, found: false, error: resolved.error || "未找到目标元素。" };
      }

      const element = resolved.element;
      const rect = element.getBoundingClientRect();
      let value = null;
      if (kind === "text") value = (element.innerText || element.textContent || "").replace(/\\s+/g, " ").trim();
      if (kind === "html") value = element.innerHTML;
      if (kind === "value") value = "value" in element ? element.value : element.getAttribute("value");
      if (kind === "attr") value = input.attribute ? element.getAttribute(input.attribute) : null;
      if (kind === "box") value = { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) };
      if (kind === "styles") {
        const computed = window.getComputedStyle(element);
        const props = Array.isArray(input.properties) && input.properties.length > 0 ? input.properties.slice(0, 80) : ["display", "position", "width", "height", "color", "background-color", "font-size", "font-weight", "opacity", "visibility", "pointer-events"];
        value = props.reduce((accumulator, property) => {
          accumulator[property] = computed.getPropertyValue(property);
          return accumulator;
        }, {});
      }

      return {
        url: location.href,
        title: document.title,
        kind,
        target: rawTarget,
        strategy: resolved.strategy,
        found: true,
        count: resolved.count,
        value,
        node: nodeSnapshot(element),
      };
    }`;
  }

  private buildStorageScript(): string {
    return `function(input) {
      const action = input && ["get", "set", "remove", "clear"].includes(input.action) ? input.action : "get";
      const area = input && input.area === "sessionStorage" ? "sessionStorage" : "localStorage";
      const storage = window[area];
      const key = typeof input.key === "string" ? input.key : "";
      try {
        let value = null;
        if (action === "get") {
          if (key) {
            value = storage.getItem(key);
          } else {
            value = {};
            for (let index = 0; index < storage.length; index += 1) {
              const itemKey = storage.key(index);
              if (itemKey) value[itemKey] = storage.getItem(itemKey);
            }
          }
        } else if (action === "set") {
          if (!key) throw new Error("key is required for storage set.");
          storage.setItem(key, typeof input.value === "string" ? input.value : "");
          value = storage.getItem(key);
        } else if (action === "remove") {
          if (!key) throw new Error("key is required for storage remove.");
          storage.removeItem(key);
        } else if (action === "clear") {
          storage.clear();
        }
        return {
          url: location.href,
          title: document.title,
          action,
          area,
          success: true,
          value,
        };
      } catch (error) {
        return {
          url: location.href,
          title: document.title,
          action,
          area,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }`;
  }

  private buildScrollScript(): string {
    return `function(input) {
      const amount = Math.max(1, Math.min(Number.isFinite(input && input.amount) ? Math.trunc(input.amount) : 720, 4000));
      const direction = input && ["up", "down", "left", "right"].includes(input.direction) ? input.direction : "down";
      const target = typeof (input && input.target) === "string" ? input.target.trim() : "";
      const strategy = input && (input.strategy === "ref" || input.strategy === "selector" || input.strategy === "xpath") ? input.strategy : "auto";
      const delta = {
        x: direction === "left" ? -amount : direction === "right" ? amount : 0,
        y: direction === "up" ? -amount : direction === "down" ? amount : 0,
      };

      function resolveXPath(xpath) {
        const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        return result.singleNodeValue;
      }

      function resolveTarget() {
        if (!target) return { element: window, error: undefined };
        const refName = target.startsWith("@") ? target.slice(1) : target;
        if ((strategy === "ref" || strategy === "auto") && /^e\\d+$/.test(refName)) {
          const cached = (window.__techCcHubBrowserRefs || {})[refName];
          if (!cached) return { element: null, error: "未找到 ref，请先调用 browser_snapshot_interactive 刷新快照。" };
          return { element: cached.xpath ? resolveXPath(cached.xpath) : document.querySelector(cached.selector), error: undefined };
        }
        if (strategy === "xpath" || (strategy === "auto" && target.startsWith("/"))) {
          return { element: resolveXPath(target), error: undefined };
        }
        try {
          return { element: document.querySelector(target), error: undefined };
        } catch (error) {
          return { element: null, error: error instanceof Error ? error.message : String(error) };
        }
      }

      const resolved = resolveTarget();
      if (!resolved.element) {
        return { url: location.href, title: document.title, success: false, target, scrollX: window.scrollX, scrollY: window.scrollY, error: resolved.error || "未找到滚动目标。" };
      }
      if (resolved.element === window) {
        window.scrollBy(delta.x, delta.y);
      } else {
        resolved.element.scrollBy(delta.x, delta.y);
      }
      return { url: location.href, title: document.title, success: true, target: target || undefined, scrollX: window.scrollX, scrollY: window.scrollY };
    }`;
  }

  private buildWaitScript(): string {
    return `function(input) {
      const start = Date.now();
      const condition = input && ["load", "selector", "text", "url", "time", "function"].includes(input.condition) ? input.condition : "load";
      const value = typeof (input && input.value) === "string" ? input.value : "";
      const strategy = input && input.strategy === "xpath" ? "xpath" : "selector";
      const state = input && ["hidden", "attached"].includes(input.state) ? input.state : "visible";
      const timeoutMs = Math.max(100, Math.min(Number.isFinite(input && input.timeoutMs) ? Math.trunc(input.timeoutMs) : 5000, 30000));

      function byXPath(xpath) {
        const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        return result.singleNodeValue;
      }

      function isVisible(element) {
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
      }

      function check() {
        if (condition === "time") return Date.now() - start >= timeoutMs;
        if (condition === "load") return document.readyState === "complete";
        if (condition === "url") return value ? location.href.includes(value) : true;
        if (condition === "text") return value ? document.body.innerText.includes(value) : true;
        if (condition === "function") {
          if (!value) return true;
          return Boolean(Function('"use strict"; return (' + value + ')')());
        }
        const element = strategy === "xpath" ? byXPath(value) : document.querySelector(value);
        if (state === "attached") return Boolean(element);
        if (state === "hidden") return !element || !isVisible(element);
        return isVisible(element);
      }

      return new Promise((resolve) => {
        function tick() {
          let success = false;
          try {
            success = check();
          } catch {
            success = false;
          }
          const elapsedMs = Date.now() - start;
          if (success || elapsedMs >= timeoutMs) {
            resolve({
              url: location.href,
              title: document.title,
              condition,
              success,
              timedOut: !success,
              elapsedMs,
            });
            return;
          }
          window.setTimeout(tick, 100);
        }
        tick();
      });
    }`;
  }

  private buildInspectStylesScript(): string {
    return `function(input) {
      const strategy = input && input.strategy === "xpath" ? "xpath" : "selector";
      const query = typeof input.query === "string" ? input.query.trim() : "";
      const index = Math.max(0, Number.isFinite(input.index) ? Math.trunc(input.index) : 0);
      const properties = Array.isArray(input.properties) && input.properties.length > 0
        ? input.properties.filter((item) => typeof item === "string" && item.trim()).slice(0, 60)
        : [
            "display",
            "position",
            "top",
            "right",
            "bottom",
            "left",
            "z-index",
            "width",
            "height",
            "margin",
            "padding",
            "color",
            "background-color",
            "border",
            "border-radius",
            "font-size",
            "font-weight",
            "line-height",
            "opacity",
            "visibility",
            "overflow",
            "pointer-events",
            "transform",
          ];

      function resolveNodes() {
        if (!query) return [];
        if (strategy === "xpath") {
          const result = document.evaluate(query, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
          const matches = [];
          for (let position = 0; position < result.snapshotLength; position += 1) {
            const item = result.snapshotItem(position);
            if (item && item.nodeType === Node.ELEMENT_NODE) {
              matches.push(item);
            }
          }
          return matches;
        }
        return Array.from(document.querySelectorAll(query));
      }

      function buildPath(element) {
        const parts = [];
        let current = element;
        while (current && current.nodeType === Node.ELEMENT_NODE) {
          const parent = current.parentElement;
          const tag = current.tagName.toLowerCase();
          const nth = parent ? Array.prototype.indexOf.call(parent.children, current) + 1 : 1;
          parts.unshift(tag + ":nth-of-type(" + nth + ")");
          current = parent;
        }
        return parts.join(" > ");
      }

      function buildXPath(element) {
        const parts = [];
        let current = element;
        while (current && current.nodeType === Node.ELEMENT_NODE) {
          let nth = 1;
          let sibling = current.previousElementSibling;
          while (sibling) {
            if (sibling.tagName === current.tagName) nth += 1;
            sibling = sibling.previousElementSibling;
          }
          parts.unshift(current.tagName.toLowerCase() + "[" + nth + "]");
          current = current.parentElement;
        }
        return "/" + parts.join("/");
      }

      function getAttributes(element) {
        return Array.from(element.attributes || []).slice(0, 24).reduce((accumulator, attribute) => {
          accumulator[attribute.name] = attribute.value;
          return accumulator;
        }, {});
      }

      const nodes = resolveNodes();
      const element = nodes[index];
      if (!element) {
        return {
          url: location.href,
          title: document.title,
          strategy,
          query,
          index,
          found: false,
        };
      }

      const computed = window.getComputedStyle(element);
      const computedStyle = properties.reduce((accumulator, property) => {
        accumulator[property] = computed.getPropertyValue(property);
        return accumulator;
      }, {});

      const cssVariables = Array.from(computed)
        .filter((property) => property.startsWith("--"))
        .slice(0, 40)
        .reduce((accumulator, property) => {
          const value = computed.getPropertyValue(property);
          if (value) {
            accumulator[property] = value;
          }
          return accumulator;
        }, {});

      const rect = element.getBoundingClientRect();
      return {
        url: location.href,
        title: document.title,
        strategy,
        query,
        index,
        found: true,
        node: {
          index,
          tagName: element.tagName.toLowerCase(),
          id: element.id || undefined,
          className: typeof element.className === "string" ? element.className : undefined,
          text: (element.innerText || element.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 240) || undefined,
          selector: element.id ? element.tagName.toLowerCase() + "#" + element.id : element.tagName.toLowerCase(),
          path: buildPath(element),
          xpath: buildXPath(element),
          htmlSnippet: element.outerHTML ? element.outerHTML.slice(0, 400) : undefined,
          attributes: getAttributes(element),
          boundingBox: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          },
        },
        inlineStyle: element.getAttribute("style") || undefined,
        computedStyle,
        cssVariables,
      };
    }`;
  }

  private buildApplyStylesScript(): string {
    return `function(input) {
      const strategy = input && input.strategy === "xpath" ? "xpath" : "selector";
      const query = typeof input.query === "string" ? input.query.trim() : "";
      const index = Math.max(0, Number.isFinite(input.index) ? Math.trunc(input.index) : 0);
      const persist = Boolean(input && input.persist);
      const rawStyles = input && input.styles && typeof input.styles === "object" && !Array.isArray(input.styles) ? input.styles : {};

      function resolveNodes() {
        if (!query) return [];
        if (strategy === "xpath") {
          const result = document.evaluate(query, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
          const matches = [];
          for (let position = 0; position < result.snapshotLength; position += 1) {
            const item = result.snapshotItem(position);
            if (item && item.nodeType === Node.ELEMENT_NODE) {
              matches.push(item);
            }
          }
          return matches;
        }
        return Array.from(document.querySelectorAll(query));
      }

      function buildPath(element) {
        const parts = [];
        let current = element;
        while (current && current.nodeType === Node.ELEMENT_NODE) {
          const parent = current.parentElement;
          const tag = current.tagName.toLowerCase();
          const nth = parent ? Array.prototype.indexOf.call(parent.children, current) + 1 : 1;
          parts.unshift(tag + ":nth-of-type(" + nth + ")");
          current = parent;
        }
        return parts.join(" > ");
      }

      function buildXPath(element) {
        const parts = [];
        let current = element;
        while (current && current.nodeType === Node.ELEMENT_NODE) {
          let nth = 1;
          let sibling = current.previousElementSibling;
          while (sibling) {
            if (sibling.tagName === current.tagName) nth += 1;
            sibling = sibling.previousElementSibling;
          }
          parts.unshift(current.tagName.toLowerCase() + "[" + nth + "]");
          current = current.parentElement;
        }
        return "/" + parts.join("/");
      }

      function getAttributes(element) {
        return Array.from(element.attributes || []).slice(0, 24).reduce((accumulator, attribute) => {
          accumulator[attribute.name] = attribute.value;
          return accumulator;
        }, {});
      }

      function snapshot(element) {
        const rect = element.getBoundingClientRect();
        return {
          index,
          tagName: element.tagName.toLowerCase(),
          id: element.id || undefined,
          className: typeof element.className === "string" ? element.className : undefined,
          text: (element.innerText || element.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 240) || undefined,
          selector: element.id ? element.tagName.toLowerCase() + "#" + element.id : element.tagName.toLowerCase(),
          path: buildPath(element),
          xpath: buildXPath(element),
          htmlSnippet: element.outerHTML ? element.outerHTML.slice(0, 400) : undefined,
          attributes: getAttributes(element),
          boundingBox: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          },
        };
      }

      function normalizeStyles(styles) {
        return Object.entries(styles).slice(0, 80).reduce((accumulator, entry) => {
          const property = String(entry[0] || "").trim();
          const value = entry[1];
          if (!property || property.length > 120) return accumulator;
          if (typeof value !== "string" && typeof value !== "number") return accumulator;
          accumulator[property] = String(value);
          return accumulator;
        }, {});
      }

      const element = resolveNodes()[index];
      const applied = normalizeStyles(rawStyles);
      if (!element) {
        return {
          url: location.href,
          title: document.title,
          strategy,
          query,
          index,
          found: false,
          applied,
          persist,
          error: "Target element was not found.",
        };
      }

      const properties = Object.keys(applied);
      const computedBefore = window.getComputedStyle(element);
      const before = properties.reduce((accumulator, property) => {
        accumulator[property] = computedBefore.getPropertyValue(property);
        return accumulator;
      }, {});
      const previousInlineStyle = element.getAttribute("style") || undefined;

      properties.forEach((property) => {
        element.style.setProperty(property, applied[property]);
      });

      const computedAfter = window.getComputedStyle(element);
      const after = properties.reduce((accumulator, property) => {
        accumulator[property] = computedAfter.getPropertyValue(property);
        return accumulator;
      }, {});

      return {
        url: location.href,
        title: document.title,
        strategy,
        query,
        index,
        found: true,
        applied,
        previousInlineStyle,
        nextInlineStyle: element.getAttribute("style") || undefined,
        before,
        after,
        persist,
        node: snapshot(element),
      };
    }`;
  }

  private buildAnnotationScript(): string {
      return `function(options) {
      const inspectAt = ${this.buildInspectScript()};
      function ensureHost() {
        let host = document.getElementById("__tech_cc_hub_annotation_host__");
        if (!host) {
          host = document.createElement("div");
          host.id = "__tech_cc_hub_annotation_host__";
          host.style.position = "fixed";
          host.style.inset = "0";
          host.style.zIndex = "2147483647";
          host.style.pointerEvents = "none";
          document.documentElement.appendChild(host);
        }
        host.hidden = false;
        if (!host.shadowRoot) {
          host.attachShadow({ mode: "open" });
        }
        return host;
      }
      function annotationRoot() {
        return ensureHost().shadowRoot;
      }
      function ensureLayer() {
        const root = annotationRoot();
        let layer = root && root.getElementById("__tech_cc_hub_annotation_layer__");
        if (layer) {
          layer.hidden = false;
          return layer;
        }
        const style = document.createElement("style");
        style.id = "__tech_cc_hub_annotation_style__";
        style.textContent = [
          "#__tech_cc_hub_annotation_layer__{position:fixed;inset:0;z-index:2147483647;isolation:isolate;pointer-events:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1f2937}",
          ".__tech_cc_hub_hover{position:fixed;z-index:10;border:2px solid #1683ff;background:rgba(22,131,255,.06);box-sizing:border-box;pointer-events:none}",
          ".__tech_cc_hub_hover_card{position:fixed;z-index:30;min-width:168px;max-width:min(320px,calc(100vw - 24px));border:1px solid rgba(15,23,42,.14);border-radius:10px;background:rgba(255,255,255,.98);box-shadow:0 10px 26px rgba(15,23,42,.18);padding:8px 10px;pointer-events:none;color:#111827;font:12px/1.35 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}",
          ".__tech_cc_hub_hover_card_head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px;color:#111827}",
          ".__tech_cc_hub_hover_card_tag{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700}",
          ".__tech_cc_hub_hover_card_size{flex:0 0 auto;color:#334155}",
          ".__tech_cc_hub_hover_card_row{display:grid;grid-template-columns:72px minmax(0,1fr);gap:8px;min-width:0;white-space:nowrap}",
          ".__tech_cc_hub_hover_card_key{color:#64748b}",
          ".__tech_cc_hub_hover_card_value{min-width:0;overflow:hidden;text-overflow:ellipsis;color:#111827}",
          ".__tech_cc_hub_marker{position:fixed;z-index:40;width:28px;height:28px;border:1px solid rgba(255,255,255,.66);border-radius:999px;background:#1683ff;color:white;display:grid;place-items:center;font-size:13px;font-weight:800;box-shadow:0 8px 24px rgba(22,131,255,.36);pointer-events:auto;cursor:pointer;outline:none}",
          ".__tech_cc_hub_marker:hover,.__tech_cc_hub_marker:focus,.__tech_cc_hub_marker:focus-visible{background:#1683ff;color:white;box-shadow:0 8px 24px rgba(22,131,255,.36);outline:none}",
          ".__tech_cc_hub_outline{position:fixed;z-index:20;border:2px solid #1683ff;background:rgba(22,131,255,.08);box-sizing:border-box;pointer-events:none}",
          ".__tech_cc_hub_comment{position:fixed;z-index:60;display:flex;flex-direction:column;width:min(340px,calc(100vw - 24px));max-height:min(430px,calc(100vh - 24px));border:1px solid rgba(15,23,42,.1);border-radius:18px;background:rgba(255,255,255,.97);box-shadow:0 14px 34px rgba(15,23,42,.16);padding:0;overflow:hidden;pointer-events:auto;color:#151922;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',sans-serif;backdrop-filter:blur(12px)}",
          ".__tech_cc_hub_comment[hidden]{display:none}",
          ".__tech_cc_hub_comment[data-editor-open='false']{width:min(360px,calc(100vw - 24px));max-height:48px;border-radius:18px}",
          ".__tech_cc_hub_comment[data-editor-open='false'] .__tech_cc_hub_flux_top{border-bottom:0}",
          ".__tech_cc_hub_comment[data-editor-open='false'] .__tech_cc_hub_flux_target,.__tech_cc_hub_comment[data-editor-open='false'] .__tech_cc_hub_tabs,.__tech_cc_hub_comment[data-editor-open='false'] .__tech_cc_hub_flux_body,.__tech_cc_hub_comment[data-editor-open='false'] .__tech_cc_hub_css_body,.__tech_cc_hub_comment[data-editor-open='false'] .__tech_cc_hub_flux_footer{display:none}",
          ".__tech_cc_hub_flux_top{display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid rgba(15,23,42,.07);background:rgba(248,249,251,.88)}",
          ".__tech_cc_hub_flux_icon{display:grid;place-items:center;width:28px;height:28px;border:0;border-radius:999px;background:#f2f4f7;color:#111827;font-size:15px;line-height:1;flex:0 0 auto;cursor:pointer}",
          ".__tech_cc_hub_flux_icon[aria-pressed='true']{background:#e8f1ff;color:#1267d8;box-shadow:0 0 0 2px rgba(22,131,255,.16)}",
          ".__tech_cc_hub_problem{min-width:0;flex:1;height:28px;border:0;outline:0;background:transparent;font-size:13px;color:#111827}",
          ".__tech_cc_hub_problem::placeholder{color:#b8bec9}",
          ".__tech_cc_hub_flux_target{display:flex;align-items:center;justify-content:space-between;gap:8px;height:32px;padding:0 14px;border-bottom:1px solid rgba(15,23,42,.06);background:#fff;font-size:13px;font-weight:700;color:#1f2937}",
          ".__tech_cc_hub_flux_drag{display:grid;place-items:center;width:28px;height:28px;border-radius:8px;color:#9aa3b2;font-size:15px;letter-spacing:1px;cursor:grab;user-select:none;flex:0 0 auto}",
          ".__tech_cc_hub_flux_drag:hover{background:#eef1f5;color:#5f6b7a}",
          ".__tech_cc_hub_quick_save{display:grid;place-items:center;width:28px;height:28px;border:0;border-radius:999px;background:#111827;color:white;font-size:14px;font-weight:800;cursor:pointer;flex:0 0 auto}",
          ".__tech_cc_hub_tabs{display:flex;gap:6px;padding:7px 12px;border-bottom:1px solid rgba(15,23,42,.06);background:#fff}",
          ".__tech_cc_hub_tab{height:24px;border:0;border-radius:999px;background:transparent;color:#6b7280;padding:0 10px;font-size:12px;font-weight:700;cursor:pointer}",
          ".__tech_cc_hub_tab[aria-selected='true']{background:#eef4ff;color:#1267d8}",
          ".__tech_cc_hub_panel[hidden]{display:none}",
          ".__tech_cc_hub_flux_body{display:flex;flex-direction:column;gap:6px;overflow:auto;padding:8px 12px 6px;background:#fff}",
          ".__tech_cc_hub_flux_section{display:flex;flex-direction:column;gap:4px;padding-bottom:8px;border-bottom:1px solid rgba(15,23,42,.07)}",
          ".__tech_cc_hub_flux_section:last-child{border-bottom:0}",
          ".__tech_cc_hub_flux_row{display:grid;grid-template-columns:92px minmax(0,1fr);align-items:center;gap:8px;min-height:28px;font-size:12px;color:#6b7280}",
          ".__tech_cc_hub_flux_row label{color:#6b7280;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
          ".__tech_cc_hub_flux_control{min-width:0;display:flex;align-items:center;height:28px;border:1px solid rgba(15,23,42,.09);border-radius:9px;background:#fff;box-shadow:0 1px 2px rgba(15,23,42,.04);overflow:hidden}",
          ".__tech_cc_hub_flux_control input,.__tech_cc_hub_flux_control select{min-width:0;width:100%;height:100%;border:0;outline:0;background:transparent;color:#5f6570;font:12px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;text-align:center;padding:0 8px}",
          ".__tech_cc_hub_flux_control select{text-align:left;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',sans-serif;color:#6b7280}",
          ".__tech_cc_hub_flux_color{gap:6px;padding:0 7px}",
          ".__tech_cc_hub_flux_color input[type='color']{width:20px;height:20px;padding:0;border:0;border-radius:7px;background:transparent;overflow:hidden;flex:0 0 auto}",
          ".__tech_cc_hub_flux_color input[type='text']{text-align:left;padding-left:0}",
          ".__tech_cc_hub_flux_unit{display:flex;align-items:center;align-self:stretch;padding:0 8px;border-left:1px solid rgba(15,23,42,.07);color:#9aa3b2;font-size:12px;background:#fbfbfc}",
          ".__tech_cc_hub_flux_quad{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));width:100%}",
          ".__tech_cc_hub_flux_quad input{border-right:1px solid rgba(15,23,42,.07)}",
          ".__tech_cc_hub_flux_quad input:last-child{border-right:0}",
          ".__tech_cc_hub_flux_footer{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;border-top:1px solid rgba(15,23,42,.07);background:rgba(255,255,255,.96)}",
          ".__tech_cc_hub_flux_actions{display:flex;align-items:center;gap:6px}",
          ".__tech_cc_hub_flux_btn{height:30px;border:1px solid rgba(15,23,42,.08);border-radius:999px;background:#fff;color:#1f2937;padding:0 12px;font-size:13px;cursor:pointer}",
          ".__tech_cc_hub_flux_btn_primary{background:#1683ff;color:white;border-color:#1683ff;font-weight:700;box-shadow:0 8px 18px rgba(22,131,255,.24)}",
          ".__tech_cc_hub_flux_btn_icon{display:grid;place-items:center;width:30px;padding:0;color:#111827;font-size:15px}",
          ".__tech_cc_hub_css_body{overflow:auto;padding:8px 12px 10px;background:#fff;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;color:#334155}",
          ".__tech_cc_hub_css_rule{border:1px solid rgba(15,23,42,.08);border-radius:10px;background:#fbfcfe;overflow:hidden}",
          ".__tech_cc_hub_css_selector{padding:8px 10px;border-bottom:1px solid rgba(15,23,42,.07);color:#1f2937;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
          ".__tech_cc_hub_css_editor{width:100%;min-height:150px;resize:vertical;border:0;outline:0;background:#fff;color:#b42318;font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;padding:8px 10px;white-space:pre;tab-size:2}",
          ".__tech_cc_hub_css_hint{margin-top:8px;color:#94a3b8;font-size:11px;line-height:1.4}",
          ".__tech_cc_hub_css_matches{margin-top:8px;display:flex;flex-direction:column;gap:6px}",
          ".__tech_cc_hub_css_match{margin:0;padding:8px 10px;border:1px solid rgba(15,23,42,.08);border-radius:10px;background:#f8fafc;color:#64748b;white-space:pre-wrap;max-height:120px;overflow:auto}",
          ".__tech_cc_hub_background{position:fixed;z-index:50;right:14px;top:14px;max-width:min(420px, calc(100vw - 40px));max-height:min(360px, calc(100vh - 28px));padding:10px 12px;border:1px solid #cbd5e1;background:rgba(255,255,255,0.98);border-radius:16px;box-shadow:0 16px 38px rgba(15,23,42,0.22);font-size:12px;line-height:1.45;color:#1f2937;overflow:hidden;display:none;pointer-events:auto;backdrop-filter:blur(6px)}",
          ".__tech_cc_hub_background[hidden]{display:none}",
          ".__tech_cc_hub_background-header{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;padding-bottom:6px;margin-bottom:8px;border-bottom:1px solid rgba(15,23,42,0.12)}",
          ".__tech_cc_hub_background-close{display:grid;place-items:center;width:20px;height:20px;border-radius:999px;border:1px solid #cbd5e1;background:#fff;line-height:1;font-size:12px;cursor:pointer}",
          ".__tech_cc_hub_background pre{margin:0;max-height:264px;overflow:auto;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;padding:8px;color:#334155;font-size:11px;white-space:pre-wrap;word-break:break-all}",
        ].join("\\n");
        root.appendChild(style);
        layer = document.createElement("div");
        layer.id = "__tech_cc_hub_annotation_layer__";
        root.appendChild(layer);
        return layer;
      }
      function getLayer() {
        const root = annotationRoot();
        return root && root.getElementById("__tech_cc_hub_annotation_layer__");
      }
      function eventTargetsOverlay(event) {
        const path = event && typeof event.composedPath === "function"
          ? event.composedPath()
          : [];
        return path.some(function(node) {
          return node
            && typeof node === "object"
            && (
              node.id === "__tech_cc_hub_annotation_host__"
              || node.id === "__tech_cc_hub_annotation_layer__"
            );
        });
      }
      function ensureBackgroundInfo() {
        const layer = ensureLayer();
        let panel = layer.querySelector(".__tech_cc_hub_background");
        if (panel) return panel;
        panel = document.createElement("div");
        panel.className = "__tech_cc_hub_background";
        panel.setAttribute("aria-live", "polite");
        panel.setAttribute("role", "dialog");
        panel.hidden = true;
        const header = document.createElement("div");
        header.className = "__tech_cc_hub_background-header";
        const title = document.createElement("div");
        title.className = "__tech_cc_hub_background-title";
        title.textContent = "背景信息";
        const close = document.createElement("button");
        close.type = "button";
        close.className = "__tech_cc_hub_background-close";
        close.textContent = "×";
        close.setAttribute("aria-label", "关闭背景信息");
        close.addEventListener("click", function() {
          panel.hidden = true;
        }, true);
        const body = document.createElement("pre");
        body.className = "__tech_cc_hub_background-content";
        header.appendChild(title);
        header.appendChild(close);
        panel.appendChild(header);
        panel.appendChild(body);
        layer.appendChild(panel);
        return panel;
      }
      function showBackgroundInfo(annotation) {
        clearBackgroundInfo();
      }
      function clearBackgroundInfo() {
        const layer = ensureLayer();
        const panel = layer.querySelector(".__tech_cc_hub_background");
        if (panel) panel.hidden = true;
      }
      function clearHoverPreview() {
        const layer = getLayer();
        const hover = layer && layer.querySelector(".__tech_cc_hub_hover");
        const hoverCard = layer && layer.querySelector(".__tech_cc_hub_hover_card");
        if (hover) hover.remove();
        if (hoverCard) hoverCard.remove();
      }
      function clearNativeAnnotationTitles() {
        const layer = getLayer();
        if (!layer) return;
        Array.from(layer.querySelectorAll(".__tech_cc_hub_outline,.__tech_cc_hub_marker,.__tech_cc_hub_comment")).forEach(function(node) {
          node.removeAttribute("title");
        });
      }
      function releasePageHoverState() {
        clearHoverPreview();
        clearNativeAnnotationTitles();
        try {
          if (document.activeElement && typeof document.activeElement.blur === "function") {
            document.activeElement.blur();
          }
        } catch {}
      }
      function uid() {
        if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
        return "ann-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
      }
      function emitAnnotation(annotation) {
        const bridge = window.__techCcHubAnnotation;
        if (bridge && typeof bridge.emit === "function") {
          bridge.emit(JSON.stringify(annotation));
        }
      }
      function annotationKey(domHint, point) {
        const hitPath = domHint && domHint.hitPath;
        const hitXPath = domHint && domHint.hitXPath;
        const selector = domHint && domHint.selectorCandidates && domHint.selectorCandidates[0];
        const xpath = domHint && domHint.xpath;
        const path = domHint && domHint.path;
        const box = domHint && domHint.boundingBox;
        if (hitPath) return "hit-path:" + hitPath;
        if (hitXPath) return "hit-xpath:" + hitXPath;
        if (selector && !/^(?:html|body|div|span|p|section|main|article|form|label|ul|li|svg|path)$/.test(selector) && !/^#(?:__nuxt|__next|app|root|main)$/i.test(selector)) {
          return "selector:" + selector;
        }
        if (xpath) return "xpath:" + xpath;
        if (path) return "path:" + path;
        if (box) return ["box", Math.round(box.x), Math.round(box.y), Math.round(box.width), Math.round(box.height)].join(":");
        return "point:" + Math.round(point.x) + ":" + Math.round(point.y);
      }
      function findAnnotationByKey(key) {
        const layer = ensureLayer();
        return Array.from(layer.querySelectorAll("[data-annotation-key]")).find(function(node) {
          return node.dataset.annotationKey === key;
        });
      }
      function removeAnnotation(id) {
        const layer = ensureLayer();
        Array.from(layer.querySelectorAll('[data-annotation-id="' + id + '"]')).forEach(function(node) {
          node.remove();
        });
        annotationStore().delete(id);
      }
      function labelFromDomHint(domHint) {
        if (!domHint) return "";
        const target = domHint.target;
        if (target && target.type === "text" && target.value) return String(target.value).trim();
        if (target && target.type === "image") return String(target.alt || target.url || "图片").trim();
        return String(
          domHint.text
          || domHint.ariaLabel
          || domHint.context && domHint.context.nearbyText
          || domHint.selector
          || domHint.path
          || "",
        ).replace(/\\s+/g, " ").trim();
      }
      function annotationTitle(annotation) {
        return "";
      }
      function annotationStore() {
        if (!window.__techCcHubAnnotations || typeof window.__techCcHubAnnotations.set !== "function") {
          window.__techCcHubAnnotations = new Map();
        }
        return window.__techCcHubAnnotations;
      }
      function resolveAnnotationXPath(xpath) {
        if (!xpath) return null;
        try {
          return document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        } catch {
          return null;
        }
      }
      function resolveAnnotationElement(annotation) {
        const domHint = annotation && annotation.domHint || {};
        const selectors = [];
        if (domHint.selector) selectors.push(domHint.selector);
        if (Array.isArray(domHint.selectorCandidates)) {
          domHint.selectorCandidates.forEach(function(selector) {
            if (selector) selectors.push(selector);
          });
        }
        for (const selector of selectors) {
          try {
            const found = document.querySelector(selector);
            if (found) return found;
          } catch {}
        }
        return resolveAnnotationXPath(domHint.xpath);
      }
      function annotationCandidateSelectors(annotation) {
        const domHint = annotation && annotation.domHint || {};
        const selectors = [];
        if (domHint.selector) selectors.push(domHint.selector);
        if (Array.isArray(domHint.selectorCandidates)) {
          domHint.selectorCandidates.forEach(function(selector) {
            if (selector) selectors.push(selector);
          });
        }
        return selectors;
      }
      function attachAnnotationAnchor(annotation, point) {
        if (!annotation || !point) return;
        let rawElement = null;
        try {
          rawElement = document.elementFromPoint(point.x, point.y);
        } catch {}
        let anchorElement = null;
        if (rawElement && typeof rawElement.closest === "function") {
          for (const selector of annotationCandidateSelectors(annotation)) {
            try {
              const matched = rawElement.closest(selector);
              if (matched) {
                anchorElement = matched;
                break;
              }
            } catch {}
          }
        }
        if (!anchorElement && rawElement && rawElement.nodeType === Node.ELEMENT_NODE) {
          anchorElement = rawElement;
        }
        if (anchorElement) {
          Object.defineProperty(annotation, "__anchorElement", {
            value: anchorElement,
            enumerable: false,
            configurable: true,
          });
        }
        const initialBox = anchorElement && typeof anchorElement.getBoundingClientRect === "function"
          ? anchorElement.getBoundingClientRect()
          : annotation.domHint && annotation.domHint.boundingBox;
        if (initialBox && initialBox.width > 0 && initialBox.height > 0 && !annotation.pageBox) {
          annotation.pageBox = {
            x: initialBox.left !== undefined ? initialBox.left + window.scrollX : initialBox.x + window.scrollX,
            y: initialBox.top !== undefined ? initialBox.top + window.scrollY : initialBox.y + window.scrollY,
            width: initialBox.width,
            height: initialBox.height,
          };
        }
      }
      function currentAnnotationBox(annotation) {
        const anchorElement = annotation && annotation.__anchorElement;
        if (anchorElement && anchorElement.isConnected && typeof anchorElement.getBoundingClientRect === "function") {
          const rect = anchorElement.getBoundingClientRect();
          if (rect && rect.width > 0 && rect.height > 0) {
            return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
          }
        }
        if (annotation && annotation.pageBox) {
          return {
            x: annotation.pageBox.x - window.scrollX,
            y: annotation.pageBox.y - window.scrollY,
            width: annotation.pageBox.width,
            height: annotation.pageBox.height,
          };
        }
        const element = resolveAnnotationElement(annotation);
        if (element && typeof element.getBoundingClientRect === "function") {
          const rect = element.getBoundingClientRect();
          if (rect && rect.width > 0 && rect.height > 0) {
            return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
          }
        }
        return annotation && annotation.domHint && annotation.domHint.boundingBox || null;
      }
      function annotationPointForBox(annotation, box) {
        if (!box) return annotation.point || { x: 0, y: 0 };
        return {
          x: box.x + Math.min(Math.max(box.width * 0.5, 14), Math.max(14, box.width - 14)),
          y: box.y + Math.min(Math.max(box.height * 0.5, 14), Math.max(14, box.height - 14)),
        };
      }
      function placeAnnotationNodes(annotation) {
        if (!annotation || !annotation.id) return;
        const layer = ensureLayer();
        const box = currentAnnotationBox(annotation);
        const outline = layer.querySelector(".__tech_cc_hub_outline[data-annotation-id='" + annotation.id + "']");
        const marker = layer.querySelector(".__tech_cc_hub_marker[data-annotation-id='" + annotation.id + "']");
        const comment = layer.querySelector(".__tech_cc_hub_comment[data-annotation-id='" + annotation.id + "']");
        if (box && box.width > 0 && box.height > 0) {
          annotation.domHint = annotation.domHint || {};
          annotation.domHint.boundingBox = box;
          if (outline) {
            outline.style.display = "block";
            outline.style.left = box.x + "px";
            outline.style.top = box.y + "px";
            outline.style.width = box.width + "px";
            outline.style.height = box.height + "px";
          }
        } else if (outline) {
          outline.style.display = "none";
        }
        const point = annotationPointForBox(annotation, box);
        annotation.point = point;
        const boxVisible = !box || (
          box.x + box.width >= 0 &&
          box.x <= window.innerWidth &&
          box.y + box.height >= 0 &&
          box.y <= window.innerHeight
        );
        if (marker) {
          marker.style.visibility = boxVisible ? "visible" : "hidden";
          marker.style.left = (box ? point.x - 14 : Math.max(6, Math.min(window.innerWidth - 30, point.x - 14))) + "px";
          marker.style.top = (box ? point.y - 14 : Math.max(6, Math.min(window.innerHeight - 30, point.y - 14))) + "px";
        }
        if (comment) {
          comment.style.visibility = boxVisible ? "visible" : "hidden";
          const placement = placePanelNearTarget(box, point, comment.dataset.editorOpen === "true");
          comment.style.left = placement.left + "px";
          comment.style.top = placement.top + "px";
        }
      }
      function syncAnnotationPositions() {
        annotationStore().forEach(function(annotation) {
          placeAnnotationNodes(annotation);
        });
        clearNativeAnnotationTitles();
      }
      function scheduleAnnotationPositionSync() {
        if (window.__techCcHubAnnotationSyncFrame) return;
        window.__techCcHubAnnotationSyncFrame = requestAnimationFrame(function() {
          window.__techCcHubAnnotationSyncFrame = null;
          syncAnnotationPositions();
        });
      }
      function setHoverNodesHidden(hover, hoverCard) {
        if (hover) hover.style.display = "none";
        if (hoverCard) hoverCard.style.display = "none";
      }
      function appendHoverCardRow(card, key, value) {
        const normalized = compactCssValue(value);
        if (!normalized) return;
        const row = document.createElement("div");
        row.className = "__tech_cc_hub_hover_card_row";
        const label = document.createElement("span");
        label.className = "__tech_cc_hub_hover_card_key";
        label.textContent = key;
        const text = document.createElement("span");
        text.className = "__tech_cc_hub_hover_card_value";
        text.textContent = normalized;
        text.title = normalized;
        row.appendChild(label);
        row.appendChild(text);
        card.appendChild(row);
      }
      function hoverColorValue(value) {
        const normalized = compactCssValue(value);
        if (!normalized || /^transparent$/i.test(normalized) || /^rgba\\(0,\\s*0,\\s*0,\\s*0\\)$/i.test(normalized)) return "";
        return /^rgba?\\(/i.test(normalized) ? rgbToHex(normalized) : normalized;
      }
      function renderHoverCard(hoverCard, domHint, box) {
        const style = domHint && domHint.computedStyle || {};
        hoverCard.replaceChildren();
        const head = document.createElement("div");
        head.className = "__tech_cc_hub_hover_card_head";
        const tag = document.createElement("span");
        tag.className = "__tech_cc_hub_hover_card_tag";
        tag.textContent = domHint && (domHint.tagName || domHint.hitTagName) || "element";
        const size = document.createElement("span");
        size.className = "__tech_cc_hub_hover_card_size";
        size.textContent = Math.round(box.width) + "x" + Math.round(box.height);
        head.appendChild(tag);
        head.appendChild(size);
        hoverCard.appendChild(head);
        appendHoverCardRow(hoverCard, "color", hoverColorValue(style.color));
        appendHoverCardRow(hoverCard, "background", hoverColorValue(style["background-color"]));
        appendHoverCardRow(hoverCard, "font", [style["font-size"], style["font-family"]].filter(Boolean).join(" "));
        appendHoverCardRow(hoverCard, "display", style.display);
        hoverCard.style.visibility = "hidden";
        hoverCard.style.display = "block";
        const rect = hoverCard.getBoundingClientRect();
        const belowTop = box.y + box.height + 6;
        const preferredTop = belowTop + rect.height <= window.innerHeight - 12 ? belowTop : box.y - rect.height - 6;
        const placement = placeWithinViewport(box.x, preferredTop, rect.width, rect.height);
        hoverCard.style.left = placement.left + "px";
        hoverCard.style.top = placement.top + "px";
        hoverCard.style.visibility = "visible";
      }
      function updateHover(point) {
        const layer = ensureLayer();
        let hover = layer.querySelector(".__tech_cc_hub_hover");
        if (!hover) {
          hover = document.createElement("div");
          hover.className = "__tech_cc_hub_hover";
          layer.appendChild(hover);
        }
        let hoverCard = layer.querySelector(".__tech_cc_hub_hover_card");
        if (!hoverCard) {
          hoverCard = document.createElement("div");
          hoverCard.className = "__tech_cc_hub_hover_card";
          layer.appendChild(hoverCard);
        }
        const domHint = inspectAt(point);
        const box = domHint && domHint.boundingBox;
        if (!box || box.width <= 0 || box.height <= 0) {
          setHoverNodesHidden(hover, hoverCard);
          return;
        }
        hover.style.display = "block";
        hover.style.left = box.x + "px";
        hover.style.top = box.y + "px";
        hover.style.width = box.width + "px";
        hover.style.height = box.height + "px";
        renderHoverCard(hoverCard, domHint, box);
      }
      function placeWithinViewport(left, top, width, height) {
        return {
          left: Math.max(12, Math.min(left, window.innerWidth - width - 12)),
          top: Math.max(12, Math.min(top, window.innerHeight - height - 12)),
        };
      }
      function compactPanelSize(editorOpen) {
        return {
          width: Math.min(editorOpen ? 340 : 360, window.innerWidth - 24),
          height: Math.min(editorOpen ? 430 : 48, window.innerHeight - 24),
        };
      }
      function placePanelNearTarget(box, point, editorOpen) {
        const size = compactPanelSize(editorOpen);
        const gap = 8;
        if (!box || box.width <= 0 || box.height <= 0) {
          return placeWithinViewport((point && point.x || 0) + gap, (point && point.y || 0) + gap, size.width, size.height);
        }
        const preferredLeft = box.x + size.width <= window.innerWidth - 12
          ? box.x
          : box.x + box.width - size.width;
        const belowTop = box.y + box.height + gap;
        const aboveTop = box.y - size.height - gap;
        const preferredTop = belowTop + size.height <= window.innerHeight - 12 ? belowTop : aboveTop;
        return placeWithinViewport(preferredLeft, preferredTop, size.width, size.height);
      }
      const STYLE_EDIT_PROPERTIES = [
        "color", "background-color", "opacity", "font-family", "font-size", "font-weight",
        "line-height", "letter-spacing", "text-align", "width", "height",
        "padding-top", "padding-right", "padding-bottom", "padding-left",
        "margin-top", "margin-right", "margin-bottom", "margin-left",
        "display", "flex-direction", "justify-content", "align-items", "gap",
        "border-radius", "border-width", "border-color",
      ];
      const LENGTH_PROPERTIES = new Set([
        "font-size", "letter-spacing", "width", "height",
        "padding-top", "padding-right", "padding-bottom", "padding-left",
        "margin-top", "margin-right", "margin-bottom", "margin-left",
        "gap", "border-radius", "border-width",
      ]);
      function compactCssValue(value) {
        return String(value || "").replace(/\\s+/g, " ").trim();
      }
      function rgbToHex(value) {
        const match = compactCssValue(value).match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/i);
        if (!match) return /^#[0-9a-f]{6}$/i.test(compactCssValue(value)) ? compactCssValue(value) : "#000000";
        return "#" + [match[1], match[2], match[3]].map(function(part) {
          return Math.max(0, Math.min(255, Number(part) || 0)).toString(16).padStart(2, "0");
        }).join("");
      }
      function numericInputValue(value) {
        const match = compactCssValue(value).match(/^-?\\d+(?:\\.\\d+)?/);
        return match ? match[0] : "";
      }
      function valueWithUnit(property, value) {
        const raw = compactCssValue(value);
        if (!raw) return "";
        if (!LENGTH_PROPERTIES.has(property)) return raw;
        if (/^(auto|inherit|initial|unset|fit-content|max-content|min-content)$/i.test(raw)) return raw;
        if (/[a-z%)]$/i.test(raw)) return raw;
        return raw + "px";
      }
      function parseCssDeclarations(cssText) {
        const raw = String(cssText || "").replace(/\\/\\*[\\s\\S]*?\\*\\//g, "");
        const block = raw.includes("{") && raw.includes("}") ? raw.slice(raw.indexOf("{") + 1, raw.lastIndexOf("}")) : raw;
        return block.split(";").map(function(entry) {
          const index = entry.indexOf(":");
          if (index <= 0) return null;
          const property = entry.slice(0, index).trim().toLowerCase();
          const value = entry.slice(index + 1).trim();
          if (!/^[a-z-]+$/.test(property) || !value) return null;
          return { property, value };
        }).filter(Boolean);
      }
      function cssDeclarationTextForElement(element) {
        const inline = element && element.getAttribute && element.getAttribute("style");
        if (!inline || !inline.trim()) return "";
        return inline.split(";").map(function(entry) {
          return entry.trim();
        }).filter(Boolean).map(function(entry) {
          return "  " + entry.replace(/;$/, "") + ";";
        }).join("\\n");
      }
      function cssSelectorLabel(annotation) {
        const domHint = annotation && annotation.domHint || {};
        return domHint.selector || domHint.hitPath || domHint.path || domHint.tagName || "element";
      }
      function applyCssText(annotation, cssText) {
        const element = selectedElementForAnnotation(annotation);
        if (!element || !element.style) return;
        ensureStyleEditState(annotation, element);
        const declarations = parseCssDeclarations(cssText);
        const nextProperties = declarations.map(function(item) { return item.property; });
        const previousProperties = annotation.__cssAppliedProperties || [];
        nextProperties.concat(previousProperties).forEach(function(property) {
          markStyleEditTouched(annotation, property);
        });
        previousProperties.forEach(function(property) {
          if (!nextProperties.includes(property)) element.style.removeProperty(property);
        });
        declarations.forEach(function(item) {
          element.style.setProperty(item.property, item.value);
        });
        Object.defineProperty(annotation, "__cssAppliedProperties", {
          value: nextProperties,
          enumerable: false,
          configurable: true,
        });
        refreshStyleEdits(annotation, element);
        emitAnnotation(annotation);
        scheduleAnnotationPositionSync();
      }
      function collectMatchedCssRules(element) {
        if (!element || typeof element.matches !== "function") return [];
        const matches = [];
        Array.from(document.styleSheets).forEach(function(sheet) {
          if (matches.length >= 5) return;
          let rules = [];
          try {
            rules = Array.from(sheet.cssRules || []);
          } catch {
            return;
          }
          rules.forEach(function(rule) {
            if (matches.length >= 5 || !rule || rule.type !== CSSRule.STYLE_RULE || !rule.selectorText || !rule.style) return;
            try {
              if (!element.matches(rule.selectorText)) return;
            } catch {
              return;
            }
            const declarations = Array.from(rule.style).slice(0, 8).map(function(property) {
              return "  " + property + ": " + rule.style.getPropertyValue(property).trim() + ";";
            }).join("\\n");
            matches.push(rule.selectorText + " {\\n" + declarations + "\\n}");
          });
        });
        return matches;
      }
      function selectedElementForAnnotation(annotation) {
        const anchor = annotation && annotation.__anchorElement;
        if (anchor && anchor.isConnected) return anchor;
        return resolveAnnotationElement(annotation) || anchor || null;
      }
      function ensureStyleEditState(annotation, element) {
        if (!annotation || !element) return;
        if (!annotation.styleBefore) {
          const computed = window.getComputedStyle(element);
          const styleBefore = {};
          STYLE_EDIT_PROPERTIES.forEach(function(property) {
            styleBefore[property] = compactCssValue(computed.getPropertyValue(property));
          });
          Object.defineProperty(annotation, "styleBefore", {
            value: styleBefore,
            enumerable: false,
            configurable: true,
          });
        }
        if (!Object.prototype.hasOwnProperty.call(annotation, "__originalInlineStyle")) {
          Object.defineProperty(annotation, "__originalInlineStyle", {
            value: element.getAttribute("style") || "",
            enumerable: false,
            configurable: true,
          });
        }
      }
      function refreshStyleEdits(annotation, element) {
        const touchedProperties = annotation && annotation.__styleTouchedProperties;
        if (!annotation || !element || !annotation.styleBefore || !touchedProperties || touchedProperties.length === 0) return [];
        const computed = window.getComputedStyle(element);
        const changes = [];
        touchedProperties.forEach(function(property) {
          const before = compactCssValue(annotation.styleBefore[property]);
          const after = compactCssValue(computed.getPropertyValue(property));
          if (before !== after) changes.push({ property, before, after });
        });
        if (changes.length > 0) {
          annotation.styleEdits = { source: "flux-like-advanced-annotation-panel", changes };
          annotation.expectation = "Apply style changes: " + changes.map(function(change) {
            return change.property + ": " + change.before + " -> " + change.after;
          }).join("; ");
          Object.defineProperty(annotation, "__styleExpectationGenerated", {
            value: true,
            enumerable: false,
            configurable: true,
          });
        } else {
          delete annotation.styleEdits;
          if (annotation.__styleExpectationGenerated) {
            delete annotation.expectation;
            delete annotation.__styleExpectationGenerated;
          }
        }
        return changes;
      }
      function markStyleEditTouched(annotation, property) {
        if (!annotation || !property) return;
        const touched = annotation.__styleTouchedProperties || [];
        const nextTouched = touched.includes(property) ? touched : touched.concat(property);
        Object.defineProperty(annotation, "__styleTouchedProperties", {
          value: nextTouched,
          enumerable: false,
          configurable: true,
        });
      }
      function applyStyleProperty(annotation, property, value) {
        const element = selectedElementForAnnotation(annotation);
        if (!element || !element.style) return;
        ensureStyleEditState(annotation, element);
        markStyleEditTouched(annotation, property);
        const normalized = valueWithUnit(property, value);
        if (normalized) element.style.setProperty(property, normalized);
        else element.style.removeProperty(property);
        refreshStyleEdits(annotation, element);
        emitAnnotation(annotation);
        scheduleAnnotationPositionSync();
      }
      function restoreStyleEdits(annotation) {
        const element = selectedElementForAnnotation(annotation);
        if (!element || !Object.prototype.hasOwnProperty.call(annotation, "__originalInlineStyle")) return;
        const original = annotation.__originalInlineStyle || "";
        if (original) element.setAttribute("style", original);
        else element.removeAttribute("style");
        delete annotation.styleEdits;
        delete annotation.styleBefore;
        delete annotation.__styleTouchedProperties;
        delete annotation.__styleExpectationGenerated;
        scheduleAnnotationPositionSync();
        emitAnnotation(annotation);
      }
      function styleSection(body) {
        const section = document.createElement("div");
        section.className = "__tech_cc_hub_flux_section";
        body.appendChild(section);
        return section;
      }
      function styleRow(section, labelText) {
        const row = document.createElement("div");
        row.className = "__tech_cc_hub_flux_row";
        const label = document.createElement("label");
        label.textContent = labelText;
        row.appendChild(label);
        section.appendChild(row);
        return row;
      }
      function addTextStyleRow(section, annotation, labelText, property, unit) {
        const element = selectedElementForAnnotation(annotation);
        const computed = element ? window.getComputedStyle(element) : null;
        const row = styleRow(section, labelText);
        const control = document.createElement("div");
        control.className = "__tech_cc_hub_flux_control";
        const input = document.createElement("input");
        input.type = LENGTH_PROPERTIES.has(property) ? "number" : "text";
        input.value = LENGTH_PROPERTIES.has(property)
          ? numericInputValue(computed && computed.getPropertyValue(property))
          : compactCssValue(computed && computed.getPropertyValue(property));
        input.addEventListener("input", function() {
          applyStyleProperty(annotation, property, input.value);
        });
        control.appendChild(input);
        if (unit) {
          const unitNode = document.createElement("span");
          unitNode.className = "__tech_cc_hub_flux_unit";
          unitNode.textContent = unit;
          control.appendChild(unitNode);
        }
        row.appendChild(control);
      }
      function addColorStyleRow(section, annotation, labelText, property) {
        const element = selectedElementForAnnotation(annotation);
        const computed = element ? window.getComputedStyle(element) : null;
        const initial = compactCssValue(computed && computed.getPropertyValue(property));
        const row = styleRow(section, labelText);
        const control = document.createElement("div");
        control.className = "__tech_cc_hub_flux_control __tech_cc_hub_flux_color";
        const color = document.createElement("input");
        color.type = "color";
        color.value = rgbToHex(initial);
        const text = document.createElement("input");
        text.type = "text";
        text.value = initial;
        color.addEventListener("input", function() {
          text.value = color.value;
          applyStyleProperty(annotation, property, color.value);
        });
        text.addEventListener("input", function() {
          applyStyleProperty(annotation, property, text.value);
        });
        control.appendChild(color);
        control.appendChild(text);
        row.appendChild(control);
      }
      function addSelectStyleRow(section, annotation, labelText, property, options) {
        const element = selectedElementForAnnotation(annotation);
        const computed = element ? window.getComputedStyle(element) : null;
        const current = compactCssValue(computed && computed.getPropertyValue(property));
        const row = styleRow(section, labelText);
        const control = document.createElement("div");
        control.className = "__tech_cc_hub_flux_control";
        const select = document.createElement("select");
        if (current && !options.some(function(option) { return option.value === current; })) {
          const currentNode = document.createElement("option");
          currentNode.value = current;
          currentNode.textContent = current;
          select.appendChild(currentNode);
        }
        options.forEach(function(option) {
          const node = document.createElement("option");
          node.value = option.value;
          node.textContent = option.label;
          select.appendChild(node);
        });
        const direct = options.find(function(option) { return option.value === current; });
        select.value = direct ? direct.value : current;
        select.addEventListener("change", function() {
          applyStyleProperty(annotation, property, select.value);
        });
        control.appendChild(select);
        row.appendChild(control);
      }
      function makePanelDraggable(panel, handle) {
        let dragState = null;
        function stopDrag() {
          dragState = null;
          window.removeEventListener("pointermove", moveDrag, true);
          window.removeEventListener("pointerup", stopDrag, true);
        }
        function moveDrag(event) {
          if (!dragState) return;
          const placement = placeWithinViewport(
            dragState.left + event.clientX - dragState.x,
            dragState.top + event.clientY - dragState.y,
            dragState.width,
            dragState.height,
          );
          panel.style.left = placement.left + "px";
          panel.style.top = placement.top + "px";
        }
        handle.addEventListener("pointerdown", function(event) {
          event.preventDefault();
          event.stopPropagation();
          const rect = panel.getBoundingClientRect();
          dragState = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top, width: rect.width, height: rect.height };
          window.addEventListener("pointermove", moveDrag, true);
          window.addEventListener("pointerup", stopDrag, true);
        }, true);
      }
      function addQuadStyleRow(section, annotation, labelText, properties) {
        const element = selectedElementForAnnotation(annotation);
        const computed = element ? window.getComputedStyle(element) : null;
        const row = styleRow(section, labelText);
        const control = document.createElement("div");
        control.className = "__tech_cc_hub_flux_control";
        const quad = document.createElement("div");
        quad.className = "__tech_cc_hub_flux_quad";
        properties.forEach(function(property) {
          const input = document.createElement("input");
          input.type = "number";
          input.value = numericInputValue(computed && computed.getPropertyValue(property));
          input.addEventListener("input", function() {
            applyStyleProperty(annotation, property, input.value);
          });
          quad.appendChild(input);
        });
        control.appendChild(quad);
        row.appendChild(control);
      }
      function drawAnnotation(annotation) {
        const layer = ensureLayer();
        const count = layer.querySelectorAll(".__tech_cc_hub_marker").length + 1;
        const box = annotation.domHint && annotation.domHint.boundingBox;
        if (box && box.width > 0 && box.height > 0 && !annotation.pageBox) {
          annotation.pageBox = {
            x: box.x + window.scrollX,
            y: box.y + window.scrollY,
            width: box.width,
            height: box.height,
          };
        }
        if (box && box.width > 0 && box.height > 0) {
          const outline = document.createElement("div");
          outline.className = "__tech_cc_hub_outline";
          outline.style.left = box.x + "px";
          outline.style.top = box.y + "px";
          outline.style.width = box.width + "px";
          outline.style.height = box.height + "px";
          outline.dataset.annotationId = annotation.id;
          outline.setAttribute("aria-label", "标注选区");
          layer.appendChild(outline);
        }
        const marker = document.createElement("button");
        marker.type = "button";
        marker.className = "__tech_cc_hub_marker";
        marker.textContent = String(count);
        marker.style.left = Math.max(6, annotation.point.x - 14) + "px";
        marker.style.top = Math.max(6, annotation.point.y - 14) + "px";
        marker.dataset.annotationId = annotation.id;
        marker.dataset.annotationKey = annotation.key;
        marker.setAttribute("aria-label", "标注 " + count);
        const comment = document.createElement("div");
        comment.className = "__tech_cc_hub_comment";
        comment.dataset.editorOpen = "false";
        const placement = placePanelNearTarget(box, annotation.point, false);
        comment.style.left = placement.left + "px";
        comment.style.top = placement.top + "px";
        comment.dataset.annotationId = annotation.id;
        comment.dataset.annotationKey = annotation.key;
        const input = document.createElement("input");
        input.className = "__tech_cc_hub_problem";
        input.placeholder = "描述这些更改...";
        input.value = annotation.comment || "";
        comment.appendChild(input);
        const top = document.createElement("div");
        top.className = "__tech_cc_hub_flux_top";
        const icon = document.createElement("button");
        icon.type = "button";
        icon.className = "__tech_cc_hub_flux_icon";
        icon.textContent = "≛";
        icon.setAttribute("aria-label", "样式控制");
        icon.setAttribute("aria-pressed", "false");
        comment.insertBefore(top, input);
        top.appendChild(icon);
        top.appendChild(input);
        const topDrag = document.createElement("span");
        topDrag.className = "__tech_cc_hub_flux_drag";
        topDrag.textContent = "⋮⋮";
        topDrag.setAttribute("aria-label", "拖动标注面板");
        top.appendChild(topDrag);
        const quickSave = document.createElement("button");
        quickSave.type = "button";
        quickSave.className = "__tech_cc_hub_quick_save";
        quickSave.textContent = "✓";
        quickSave.setAttribute("aria-label", "保存标注");
        top.appendChild(quickSave);
        makePanelDraggable(comment, topDrag);
        const expectationInput = document.createElement("input");
        expectationInput.className = "__tech_cc_hub_expectation";
        expectationInput.placeholder = "预期状态（可选）...";
        expectationInput.value = annotation.expectation || "";
        comment.appendChild(expectationInput);
        const submit = document.createElement("button");
        submit.type = "button";
        submit.className = "__tech_cc_hub_submit";
        submit.textContent = "➜";
        submit.setAttribute("aria-label", "保存评论");
        comment.appendChild(submit);
        expectationInput.style.display = "none";
        submit.style.display = "none";
        const selectedElement = selectedElementForAnnotation(annotation);
        if (selectedElement) ensureStyleEditState(annotation, selectedElement);
        const target = document.createElement("div");
        target.className = "__tech_cc_hub_flux_target";
        const targetName = document.createElement("span");
        targetName.textContent = annotation.domHint && annotation.domHint.tagName || "element";
        target.appendChild(targetName);
        comment.appendChild(target);
        const tabs = document.createElement("div");
        tabs.className = "__tech_cc_hub_tabs";
        const visualTab = document.createElement("button");
        visualTab.type = "button";
        visualTab.className = "__tech_cc_hub_tab";
        visualTab.textContent = "Visual";
        visualTab.setAttribute("aria-selected", "true");
        const cssTab = document.createElement("button");
        cssTab.type = "button";
        cssTab.className = "__tech_cc_hub_tab";
        cssTab.textContent = "CSS";
        cssTab.setAttribute("aria-selected", "false");
        tabs.appendChild(visualTab);
        tabs.appendChild(cssTab);
        comment.appendChild(tabs);
        const body = document.createElement("div");
        body.className = "__tech_cc_hub_flux_body __tech_cc_hub_panel";
        comment.appendChild(body);
        const colorSection = styleSection(body);
        addColorStyleRow(colorSection, annotation, "文字颜色", "color");
        addColorStyleRow(colorSection, annotation, "背景", "background-color");
        addTextStyleRow(colorSection, annotation, "Opacity", "opacity", "");
        const typeSection = styleSection(body);
        addSelectStyleRow(typeSection, annotation, "字体", "font-family", [
          { value: "system-ui, sans-serif", label: "System UI" },
          { value: "'PingFang SC', sans-serif", label: "PingFang SC" },
          { value: "Inter, sans-serif", label: "Inter" },
          { value: "ui-monospace, monospace", label: "Monospace" },
        ]);
        addTextStyleRow(typeSection, annotation, "字号", "font-size", "px");
        addSelectStyleRow(typeSection, annotation, "字重", "font-weight", [
          { value: "300", label: "300" },
          { value: "400", label: "400" },
          { value: "500", label: "500" },
          { value: "600", label: "600" },
          { value: "700", label: "700" },
          { value: "800", label: "800" },
        ]);
        addTextStyleRow(typeSection, annotation, "行高", "line-height", "");
        addTextStyleRow(typeSection, annotation, "字距", "letter-spacing", "px");
        addSelectStyleRow(typeSection, annotation, "对齐", "text-align", [
          { value: "left", label: "Left" },
          { value: "center", label: "Center" },
          { value: "right", label: "Right" },
          { value: "justify", label: "Justify" },
        ]);
        const boxSection = styleSection(body);
        addTextStyleRow(boxSection, annotation, "宽度", "width", "px");
        addTextStyleRow(boxSection, annotation, "高度", "height", "px");
        addQuadStyleRow(boxSection, annotation, "内边距", ["padding-top", "padding-right", "padding-bottom", "padding-left"]);
        addQuadStyleRow(boxSection, annotation, "外边距", ["margin-top", "margin-right", "margin-bottom", "margin-left"]);
        const layoutSection = styleSection(body);
        addSelectStyleRow(layoutSection, annotation, "Display", "display", [
          { value: "block", label: "Block" },
          { value: "flex", label: "Flex" },
          { value: "grid", label: "Grid" },
          { value: "inline-flex", label: "Inline flex" },
          { value: "inline-block", label: "Inline block" },
        ]);
        addSelectStyleRow(layoutSection, annotation, "Layout direction", "flex-direction", [
          { value: "row", label: "Horizontal" },
          { value: "column", label: "Vertical" },
          { value: "row-reverse", label: "Horizontal reverse" },
          { value: "column-reverse", label: "Vertical reverse" },
        ]);
        addSelectStyleRow(layoutSection, annotation, "Distribution", "justify-content", [
          { value: "flex-start", label: "Start" },
          { value: "center", label: "Center" },
          { value: "space-between", label: "Space between" },
          { value: "space-around", label: "Space around" },
          { value: "flex-end", label: "End" },
        ]);
        addSelectStyleRow(layoutSection, annotation, "Alignment", "align-items", [
          { value: "stretch", label: "Stretch" },
          { value: "flex-start", label: "Start" },
          { value: "center", label: "Center" },
          { value: "flex-end", label: "End" },
        ]);
        addTextStyleRow(layoutSection, annotation, "Spacing", "gap", "px");
        const borderSection = styleSection(body);
        addTextStyleRow(borderSection, annotation, "圆角", "border-radius", "px");
        addTextStyleRow(borderSection, annotation, "边框宽度", "border-width", "px");
        addColorStyleRow(borderSection, annotation, "边框颜色", "border-color");
        const cssBody = document.createElement("div");
        cssBody.className = "__tech_cc_hub_css_body __tech_cc_hub_panel";
        cssBody.hidden = true;
        const cssRule = document.createElement("div");
        cssRule.className = "__tech_cc_hub_css_rule";
        const cssSelector = document.createElement("div");
        cssSelector.className = "__tech_cc_hub_css_selector";
        cssSelector.textContent = cssSelectorLabel(annotation) + " {";
        const cssEditor = document.createElement("textarea");
        cssEditor.className = "__tech_cc_hub_css_editor";
        cssEditor.spellcheck = false;
        cssEditor.value = cssDeclarationTextForElement(selectedElement);
        const cssClose = document.createElement("div");
        cssClose.className = "__tech_cc_hub_css_selector";
        cssClose.textContent = "}";
        cssRule.appendChild(cssSelector);
        cssRule.appendChild(cssEditor);
        cssRule.appendChild(cssClose);
        cssBody.appendChild(cssRule);
        const cssHint = document.createElement("div");
        cssHint.className = "__tech_cc_hub_css_hint";
        cssHint.textContent = "Edit CSS declarations here for live inline styles.";
        cssBody.appendChild(cssHint);
        const matchedRules = collectMatchedCssRules(selectedElement);
        if (matchedRules.length > 0) {
          const matches = document.createElement("div");
          matches.className = "__tech_cc_hub_css_matches";
          matchedRules.forEach(function(ruleText) {
            const match = document.createElement("pre");
            match.className = "__tech_cc_hub_css_match";
            match.textContent = ruleText;
            matches.appendChild(match);
          });
          cssBody.appendChild(matches);
        }
        comment.appendChild(cssBody);
        const footer = document.createElement("div");
        footer.className = "__tech_cc_hub_flux_footer";
        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "__tech_cc_hub_flux_btn __tech_cc_hub_flux_btn_icon";
        removeButton.textContent = "⌫";
        removeButton.setAttribute("aria-label", "删除标注");
        const actions = document.createElement("div");
        actions.className = "__tech_cc_hub_flux_actions";
        const cancel = document.createElement("button");
        cancel.type = "button";
        cancel.className = "__tech_cc_hub_flux_btn";
        cancel.textContent = "取消";
        const save = document.createElement("button");
        save.type = "button";
        save.className = "__tech_cc_hub_flux_btn __tech_cc_hub_flux_btn_primary";
        save.textContent = "保存";
        actions.appendChild(cancel);
        actions.appendChild(save);
        footer.appendChild(removeButton);
        footer.appendChild(actions);
        comment.appendChild(footer);
        function setEditorOpen(open) {
          comment.dataset.editorOpen = open ? "true" : "false";
          icon.setAttribute("aria-pressed", open ? "true" : "false");
          if (open) {
            const rect = comment.getBoundingClientRect();
            const size = compactPanelSize(true);
            const placement = placeWithinViewport(rect.left, rect.top, size.width, size.height);
            comment.style.left = placement.left + "px";
            comment.style.top = placement.top + "px";
          }
        }
        function setActiveTab(tabName) {
          const cssActive = tabName === "css";
          visualTab.setAttribute("aria-selected", cssActive ? "false" : "true");
          cssTab.setAttribute("aria-selected", cssActive ? "true" : "false");
          body.hidden = cssActive;
          cssBody.hidden = !cssActive;
          if (cssActive) {
            const element = selectedElementForAnnotation(annotation);
            if (element) cssEditor.value = cssDeclarationTextForElement(element);
          }
        }
        function submitComment() {
          annotation.comment = input.value.trim();
          if (!annotation.styleEdits) annotation.expectation = expectationInput.value.trim();
          emitAnnotation(annotation);
          comment.hidden = true;
        }
        function discardAnnotation() {
          restoreStyleEdits(annotation);
          const removed = {
            id: annotation.id,
            url: window.location.href,
            title: document.title,
            createdAt: Date.now(),
            point: annotation.point,
            domHint: annotation.domHint,
            removed: true,
          };
          removeAnnotation(annotation.id);
          emitAnnotation(removed);
          clearBackgroundInfo();
        }
        function updateSubmitState() {
          annotation.comment = input.value;
          if (!annotation.styleEdits) annotation.expectation = expectationInput.value;
          emitAnnotation(annotation);
          showBackgroundInfo(annotation);
          submit.disabled = !input.value.trim() && !expectationInput.value.trim();
        }
        marker.addEventListener("click", function(event) {
          event.preventDefault();
          event.stopPropagation();
          showBackgroundInfo(annotation);
          comment.hidden = !comment.hidden;
          if (!comment.hidden) {
            input.value = annotation.comment || input.value;
            expectationInput.value = annotation.expectation || expectationInput.value;
            requestAnimationFrame(function() {
              input.focus();
              input.setSelectionRange(input.value.length, input.value.length);
            });
          }
        }, true);
        submit.addEventListener("click", function(event) {
          event.preventDefault();
          event.stopPropagation();
          submitComment();
        }, true);
        quickSave.addEventListener("click", function(event) {
          event.preventDefault();
          event.stopPropagation();
          submitComment();
        }, true);
        icon.addEventListener("click", function(event) {
          event.preventDefault();
          event.stopPropagation();
          setEditorOpen(comment.dataset.editorOpen !== "true");
        }, true);
        visualTab.addEventListener("click", function(event) {
          event.preventDefault();
          event.stopPropagation();
          setActiveTab("visual");
        }, true);
        cssTab.addEventListener("click", function(event) {
          event.preventDefault();
          event.stopPropagation();
          setActiveTab("css");
          requestAnimationFrame(function() {
            cssEditor.focus();
          });
        }, true);
        cssEditor.addEventListener("input", function() {
          applyCssText(annotation, cssEditor.value);
        });
        cssEditor.addEventListener("keydown", function(event) {
          if (event.key === "Tab") {
            event.preventDefault();
            const start = cssEditor.selectionStart || 0;
            const end = cssEditor.selectionEnd || 0;
            cssEditor.value = cssEditor.value.slice(0, start) + "  " + cssEditor.value.slice(end);
            cssEditor.selectionStart = cssEditor.selectionEnd = start + 2;
            applyCssText(annotation, cssEditor.value);
          }
          if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
            event.preventDefault();
            submitComment();
          }
        });
        save.addEventListener("click", function(event) {
          event.preventDefault();
          event.stopPropagation();
          submitComment();
        }, true);
        cancel.addEventListener("click", function(event) {
          event.preventDefault();
          event.stopPropagation();
          discardAnnotation();
        }, true);
        removeButton.addEventListener("click", function(event) {
          event.preventDefault();
          event.stopPropagation();
          discardAnnotation();
        }, true);
        comment.addEventListener("mousedown", function(event) {
          event.stopPropagation();
        });
        comment.addEventListener("click", function(event) {
          event.stopPropagation();
        });
        input.addEventListener("focus", function() {
          comment.hidden = false;
        });
        input.addEventListener("input", updateSubmitState);
        expectationInput.addEventListener("input", updateSubmitState);
        input.addEventListener("keydown", function(event) {
          if (event.key === "Enter") {
            event.preventDefault();
            submitComment();
          }
          if (event.key === "Escape") comment.hidden = true;
        });
        expectationInput.addEventListener("keydown", function(event) {
          if (event.key === "Enter") {
            event.preventDefault();
            submitComment();
          }
          if (event.key === "Escape") comment.hidden = true;
        });
        submit.disabled = !input.value.trim() && !expectationInput.value.trim();
        layer.appendChild(marker);
        layer.appendChild(comment);
        annotationStore().set(annotation.id, annotation);
        placeAnnotationNodes(annotation);
        requestAnimationFrame(function() { input.focus(); });
      }
      if (window.__techCcHubAnnotationHandler) {
        document.removeEventListener("click", window.__techCcHubAnnotationHandler, true);
        window.__techCcHubAnnotationHandler = null;
      }
      if (window.__techCcHubAnnotationHoverHandler) {
        document.removeEventListener("mousemove", window.__techCcHubAnnotationHoverHandler, true);
        window.__techCcHubAnnotationHoverHandler = null;
      }
      if (window.__techCcHubAnnotationScrollHandler) {
        window.removeEventListener("scroll", window.__techCcHubAnnotationScrollHandler, true);
        document.removeEventListener("scroll", window.__techCcHubAnnotationScrollHandler, true);
        window.__techCcHubAnnotationScrollHandler = null;
      }
      if (window.__techCcHubAnnotationResizeHandler) {
        window.removeEventListener("resize", window.__techCcHubAnnotationResizeHandler, true);
        window.__techCcHubAnnotationResizeHandler = null;
      }
      clearHoverPreview();
      clearNativeAnnotationTitles();
      if (!options.enabled) {
        const host = document.getElementById("__tech_cc_hub_annotation_host__");
        const layer = getLayer();
        if (layer) layer.hidden = true;
        if (host) host.hidden = true;
        return true;
      }
      ensureLayer().hidden = false;
      window.__techCcHubAnnotationHoverHandler = function(event) {
        if (eventTargetsOverlay(event)) {
          return;
        }
        updateHover({ x: event.clientX, y: event.clientY });
      };
      window.__techCcHubAnnotationHandler = function(event) {
        if (eventTargetsOverlay(event)) {
          return;
        }
        const point = { x: event.clientX, y: event.clientY };
        const domHint = inspectAt(point);
        event.preventDefault();
        event.stopPropagation();
        releasePageHoverState();
        const key = annotationKey(domHint, point);
        const existing = findAnnotationByKey(key);
        if (existing) {
          const removed = {
            id: existing.dataset.annotationId,
            url: window.location.href,
            title: document.title,
            createdAt: Date.now(),
            point,
            domHint,
            removed: true,
          };
          removeAnnotation(existing.dataset.annotationId);
          emitAnnotation(removed);
          updateHover(point);
          clearBackgroundInfo();
          return;
        }
        const annotation = {
          id: uid(),
          key,
          url: window.location.href,
          title: document.title,
          createdAt: Date.now(),
          point,
          domHint,
          comment: "",
        };
        attachAnnotationAnchor(annotation, point);
        drawAnnotation(annotation);
        showBackgroundInfo(annotation);
        emitAnnotation(annotation);
      };
      window.__techCcHubAnnotationScrollHandler = scheduleAnnotationPositionSync;
      window.__techCcHubAnnotationResizeHandler = scheduleAnnotationPositionSync;
      document.addEventListener("mousemove", window.__techCcHubAnnotationHoverHandler, true);
      document.addEventListener("click", window.__techCcHubAnnotationHandler, true);
      window.addEventListener("scroll", window.__techCcHubAnnotationScrollHandler, true);
      document.addEventListener("scroll", window.__techCcHubAnnotationScrollHandler, true);
      window.addEventListener("resize", window.__techCcHubAnnotationResizeHandler, true);
      return true;
      }`;
  }

  private buildPageSnapshotScript(): string {
    return `function() {
      function cleanText(value) {
        return String(value || "").replace(/\\s+/g, " ").trim();
      }
      function attr(node, name) {
        return node && node.getAttribute ? cleanText(node.getAttribute(name)) : "";
      }
      const title = cleanText(document.title);
      const description = attr(document.querySelector('meta[name="description"], meta[property="og:description"]'), "content");
      const canonicalUrl = attr(document.querySelector('link[rel="canonical"]'), "href");
      const selectedText = cleanText(window.getSelection && window.getSelection().toString());
      const text = cleanText(document.body ? document.body.innerText : "");
      const headings = Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6")).slice(0, 80).map(function(node) {
        return {
          level: Number(node.tagName.slice(1)) || 0,
          text: cleanText(node.textContent),
        };
      }).filter(function(item) { return item.text; });
      const links = Array.from(document.querySelectorAll("a[href]")).slice(0, 160).map(function(node) {
        return {
          text: cleanText(node.textContent || node.getAttribute("aria-label") || node.getAttribute("title")),
          href: node.href,
        };
      }).filter(function(item) { return item.href; });
      const images = Array.from(document.querySelectorAll("img[src]")).slice(0, 80).map(function(node) {
        return {
          src: node.currentSrc || node.src,
          alt: cleanText(node.alt || node.getAttribute("aria-label") || node.title),
        };
      }).filter(function(item) { return item.src; });
      return {
        url: location.href,
        title: title,
        description: description,
        canonicalUrl: canonicalUrl,
        selectedText: selectedText,
        text: text.slice(0, 60000),
        headings: headings,
        links: links,
        images: images,
      };
    }`;
  }

  private buildInspectScript(): string {
    return `function(point) {
      function cssEscape(value) {
        if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(value);
        return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\\\$&");
      }
      function cleanText(value) {
        return String(value || "").replace(/\\s+/g, " ").trim();
      }
      function textOf(element) {
        return cleanText(element.innerText || element.textContent || "").slice(0, 160);
      }
      function buildXPath(element) {
        const parts = [];
        let current = element;
        while (current && current.nodeType === Node.ELEMENT_NODE) {
          let nth = 1;
          let sibling = current.previousElementSibling;
          while (sibling) {
            if (sibling.tagName === current.tagName) nth += 1;
            sibling = sibling.previousElementSibling;
          }
          parts.unshift(current.tagName.toLowerCase() + "[" + nth + "]");
          current = current.parentElement;
        }
        return "/" + parts.join("/");
      }
      function isActionableElement(element) {
        if (!element || !element.matches) return false;
        if (element.matches("button, a[href], input, select, textarea, summary, label")) return true;
        if (element.matches("[role='button'], [role='link'], [role='tab'], [role='menuitem']")) return true;
        if (element.matches("[data-testid], [data-test], [data-qa], [data-cy], [aria-controls], [onclick]")) return true;
        return false;
      }
      function isGenericRootId(value) {
        const id = cleanText(value);
        return /^(?:__nuxt|__next|app|root|main)$/i.test(id) || /^el-id-\\d+-\\d+$/i.test(id);
      }
      function isReasonableHintElement(element) {
        if (!element || !element.getBoundingClientRect) return false;
        const rect = element.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return false;
        const viewportWidth = Math.max(window.innerWidth || 0, document.documentElement.clientWidth || 0, 1);
        const viewportHeight = Math.max(window.innerHeight || 0, document.documentElement.clientHeight || 0, 1);
        const areaRatio = (rect.width * rect.height) / (viewportWidth * viewportHeight);
        if (areaRatio >= 0.72) return false;
        if (rect.width >= viewportWidth * 0.96 && rect.height >= viewportHeight * 0.72) return false;
        if (rect.width >= viewportWidth * 0.82 && rect.height >= viewportHeight * 0.82) return false;
        return true;
      }
      function hasStableHint(element) {
        if (!element || !element.getAttribute) return false;
        if (element.getAttribute("data-testid") || element.getAttribute("data-test")) return true;
        if (element.getAttribute("data-qa") || element.getAttribute("data-cy")) return true;
        if (cleanText(element.getAttribute("aria-label"))) return true;
        const id = cleanText(element.id || "");
        if (!id || isGenericRootId(id)) return false;
        return isReasonableHintElement(element);
      }
      function isIconLikeElement(element) {
        if (!element || !element.matches) return false;
        if (element.matches("svg, path, use, i")) return true;
        return Array.from(element.classList || []).some(function(className) {
          return /(?:^|[-_])icon(?:$|[-_])|svg|caret|arrow/i.test(className);
        });
      }
      function hasElementSpecificText(element, promoted) {
        if (!element) return false;
        const directText = Array.from(element.childNodes || []).some(function(node) {
          return node.nodeType === Node.TEXT_NODE && cleanText(node.textContent);
        });
        if (directText) return true;
        const text = textOf(element);
        if (!text) return false;
        const promotedText = promoted ? textOf(promoted) : "";
        if (promotedText && text !== promotedText) return true;
        return (element.children || []).length <= 1 && text.length <= 160;
      }
      function shouldPreferExactElement(element, promoted) {
        if (!element || !promoted || element === promoted) return false;
        if (!isReasonableHintElement(element)) return false;
        if (isIconLikeElement(element) && !hasStableHint(element)) return false;
        if (hasStableHint(element)) return true;
        return hasElementSpecificText(element, promoted);
      }
      function findPreferredElement(element) {
        if (!element) return element;
        const actionable = element.closest && element.closest(
          "button, a[href], input, select, textarea, summary, label, [role='button'], [role='link'], [role='tab'], [role='menuitem'], [data-testid], [data-test], [data-qa], [data-cy], [aria-controls], [onclick]",
        );
        if (actionable) {
          if (shouldPreferExactElement(element, actionable)) {
            return element;
          }
          return actionable;
        }
        let current = element;
        while (current && current !== document.documentElement) {
          if (hasStableHint(current)) {
            if (shouldPreferExactElement(element, current)) {
              return element;
            }
            return current;
          }
          current = current.parentElement;
        }
        if (isReasonableHintElement(element)) {
          return element;
        }
        let fallback = element.parentElement;
        while (fallback && fallback !== document.documentElement) {
          if (isReasonableHintElement(fallback)) {
            return fallback;
          }
          fallback = fallback.parentElement;
        }
        return element;
      }
      function selectorCandidates(element) {
        const candidates = [];
        const tagName = element.tagName.toLowerCase();
        if (element.id) candidates.push("#" + cssEscape(element.id));
        const dataAttributeNames = ["data-testid", "data-test", "data-qa", "data-cy"];
        dataAttributeNames.forEach(function(attributeName) {
          const attributeValue = element.getAttribute(attributeName);
          if (attributeValue) {
            candidates.push("[" + attributeName + "='" + String(attributeValue).replace(/'/g, "\\\\'") + "']");
            candidates.push(tagName + "[" + attributeName + "='" + String(attributeValue).replace(/'/g, "\\\\'") + "']");
          }
        });
        const aria = element.getAttribute("aria-label");
        if (aria) candidates.push(tagName + "[aria-label='" + String(aria).replace(/'/g, "\\\\'") + "']");
        const name = element.getAttribute("name");
        if (name) candidates.push(tagName + "[name='" + String(name).replace(/'/g, "\\\\'") + "']");
        const type = element.getAttribute("type");
        if (type) candidates.push(tagName + "[type='" + String(type).replace(/'/g, "\\\\'") + "']");
        const classes = Array.from(element.classList || []).slice(0, 3).map(cssEscape);
        if (classes.length) candidates.push(tagName + "." + classes.join("."));
        if (isActionableElement(element)) {
          const text = textOf(element);
          if (text && text.length <= 60) {
            candidates.push(tagName + "[title='" + text.replace(/'/g, "\\\\'") + "']");
          }
        }
        candidates.push(tagName);
        return Array.from(new Set(candidates.filter(Boolean))).slice(0, 8);
      }
      function pathOf(element) {
        const parts = [];
        let current = element;
        while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.documentElement) {
          const tag = current.tagName.toLowerCase();
          const parent = current.parentElement;
          if (!parent) {
            parts.unshift(tag);
            break;
          }
          const siblings = Array.from(parent.children).filter(function(child) {
            return child.tagName === current.tagName;
          });
          const index = siblings.indexOf(current) + 1;
          parts.unshift(siblings.length > 1 ? tag + ":nth-of-type(" + index + ")" : tag);
          current = parent;
        }
        parts.unshift("html");
        return parts.join(" > ");
      }
      function targetOf(element) {
        const image = element.tagName === "IMG" ? element : element.closest && element.closest("img");
        if (image) {
          const url = image.currentSrc || image.src || image.getAttribute("src");
          if (url) return { type: "image", url, alt: image.alt || image.getAttribute("aria-label") || undefined };
        }
        const text = textOf(element);
        if (text) return { type: "text", value: text };
        return undefined;
      }
      function getSimpleComputedStyle(element) {
        const computed = window.getComputedStyle(element);
        return [
          "color",
          "background-color",
          "font-size",
          "font-family",
          "font-weight",
          "line-height",
          "display",
        ].reduce(function(accumulator, property) {
          accumulator[property] = computed.getPropertyValue(property);
          return accumulator;
        }, {});
      }
      function pushUnique(list, value) {
        const normalized = cleanText(value);
        if (!normalized || list.includes(normalized)) return;
        list.push(normalized);
      }
      function componentNameFromReactFiber(fiber) {
        if (!fiber) return "";
        const type = fiber.elementType || fiber.type;
        if (typeof type === "function") return type.displayName || type.name || "";
        if (type && typeof type === "object") return type.displayName || type.name || "";
        if (typeof type === "string") return "";
        return fiber._debugOwner && componentNameFromReactFiber(fiber._debugOwner);
      }
      function reactFiberFromElement(element) {
        if (!element) return null;
        const key = Object.keys(element).find(function(item) {
          return item.startsWith("__reactFiber$") || item.startsWith("__reactInternalInstance$");
        });
        return key ? element[key] : null;
      }
      function toNumber(value) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
      }
      function cleanCandidate(candidate) {
        if (!candidate) return null;
        const component = cleanText(candidate.component || "");
        const file = cleanText(candidate.file || "");
        if (!component && !file) return null;
        return {
          component: component || undefined,
          file: file || undefined,
          line: toNumber(candidate.line),
          column: toNumber(candidate.column),
          framework: candidate.framework,
          source: candidate.source,
          confidence: candidate.confidence,
        };
      }
      function pushCandidate(list, seen, candidate) {
        const normalized = cleanCandidate(candidate);
        if (!normalized) return;
        const key = [
          normalized.component || "",
          normalized.file || "",
          normalized.line || "",
          normalized.column || "",
          normalized.source || "",
        ].join("|");
        if (seen.has(key)) return;
        seen.add(key);
        list.push(normalized);
      }
      function reactSourceFromFiber(fiber) {
        const source = fiber && (fiber._debugSource || fiber._debugOwner && fiber._debugOwner._debugSource);
        if (!source) return null;
        return {
          file: source.fileName || source.file,
          line: source.lineNumber || source.line,
          column: source.columnNumber || source.column,
        };
      }
      function collectReactBridge(element, stack, candidates, seen) {
        let currentElement = element;
        while (currentElement && stack.length < 12 && candidates.length < 12) {
          let fiber = reactFiberFromElement(currentElement);
          while (fiber && stack.length < 12 && candidates.length < 12) {
            const component = componentNameFromReactFiber(fiber);
            const source = reactSourceFromFiber(fiber);
            pushUnique(stack, component);
            if (component || source) {
              pushCandidate(candidates, seen, {
                component,
                file: source && source.file,
                line: source && source.line,
                column: source && source.column,
                framework: "react",
                source: source && source.file ? "react-debug-source" : "component-stack",
                confidence: source && source.file ? "high" : "medium",
              });
            }
            fiber = fiber.return;
          }
          currentElement = currentElement.parentElement;
        }
      }
      function collectVueBridge(element, stack, candidates, seen) {
        let currentElement = element;
        while (currentElement && stack.length < 12 && candidates.length < 12) {
          let component = currentElement.__vueParentComponent || currentElement.__vue__;
          while (component && stack.length < 12 && candidates.length < 12) {
            const type = component.type || component.$options || {};
            const name = type.name || type.__name || type.displayName;
            const file = type.__file || type.__hmrId || component.__file;
            pushUnique(stack, name);
            if (name || file) {
              pushCandidate(candidates, seen, {
                component: name,
                file,
                framework: "vue",
                source: file ? "vue-file" : "component-stack",
                confidence: file ? "high" : "medium",
              });
            }
            component = component.parent || component.$parent;
          }
          currentElement = currentElement.parentElement;
        }
      }
      function collectClassComponentHints(element, stack, candidates, seen) {
        let current = element;
        while (current && current !== document.documentElement && stack.length < 12 && candidates.length < 12) {
          const classes = Array.from(current.classList || []);
          classes.forEach(function(className) {
            if (/^el-[a-z0-9-]+$/i.test(className)) {
              const name = className.split("-").filter(Boolean).map(function(part) {
                return part.charAt(0).toUpperCase() + part.slice(1);
              }).join("");
              pushUnique(stack, name);
              pushCandidate(candidates, seen, {
                component: name,
                framework: "class",
                source: "class-name",
                confidence: "low",
              });
            }
          });
          current = current.parentElement;
        }
      }
      function buildComponentBridge(element) {
        const stack = [];
        const sourceCandidates = [];
        const seenCandidates = new Set();
        collectReactBridge(element, stack, sourceCandidates, seenCandidates);
        collectVueBridge(element, stack, sourceCandidates, seenCandidates);
        collectClassComponentHints(element, stack, sourceCandidates, seenCandidates);
        const hasHigh = sourceCandidates.some(function(candidate) { return candidate.confidence === "high"; });
        const hasMedium = sourceCandidates.some(function(candidate) { return candidate.confidence === "medium"; });
        return {
          componentStack: stack.slice(0, 12),
          sourceCandidates: sourceCandidates.slice(0, 12),
          componentStackSource: hasHigh ? "devtools-runtime-source" : hasMedium ? "framework-runtime" : stack.length ? "dom-class-hints" : undefined,
          componentStackConfidence: hasHigh ? "high" : hasMedium ? "medium" : stack.length ? "low" : undefined,
        };
      }
      function compactElementLabel(element) {
        const tag = element.tagName ? element.tagName.toLowerCase() : "";
        const id = cleanText(element.id || "");
        const classes = Array.from(element.classList || []).slice(0, 4).join(".");
        const role = cleanText(element.getAttribute && element.getAttribute("role"));
        const aria = cleanText(element.getAttribute && element.getAttribute("aria-label"));
        const text = textOf(element).slice(0, 90);
        return [
          tag,
          id ? "#" + id : "",
          classes ? "." + classes : "",
          role ? "[role=" + role + "]" : "",
          aria ? "[aria=" + aria + "]" : "",
          text ? "text=" + text : "",
        ].filter(Boolean).join(" ");
      }
      function buildContext(element) {
        const ancestorChain = [];
        let current = element.parentElement;
        while (current && current !== document.documentElement && ancestorChain.length < 6) {
          if (isReasonableHintElement(current)) {
            const label = compactElementLabel(current);
            if (label) ancestorChain.push(label);
          }
          current = current.parentElement;
        }
        const container = element.closest && element.closest("section, main, article, form, table, [role='dialog'], .el-dialog, .el-card, .el-table, .el-form, .content, .main, .page");
        const nearbyText = container ? textOf(container).slice(0, 360) : undefined;
        return {
          ancestorChain,
          nearbyText,
        };
      }
      const rawElement = document.elementFromPoint(point.x, point.y);
      if (!rawElement) return null;
      const element = findPreferredElement(rawElement);
      const rect = element.getBoundingClientRect();
      const rawRect = rawElement.getBoundingClientRect();
      const candidates = selectorCandidates(element);
      const componentBridge = buildComponentBridge(element);
      return {
        tagName: element.tagName.toLowerCase(),
        role: element.getAttribute("role") || undefined,
        text: textOf(element) || undefined,
        ariaLabel: element.getAttribute("aria-label") || undefined,
        selector: candidates[0],
        path: pathOf(element),
        xpath: buildXPath(element),
        hitTagName: rawElement.tagName.toLowerCase(),
        hitPath: pathOf(rawElement),
        hitXPath: buildXPath(rawElement),
        hitBoundingBox: {
          x: rawRect.x,
          y: rawRect.y,
          width: rawRect.width,
          height: rawRect.height,
        },
        target: targetOf(element),
        selectorCandidates: candidates,
        componentStack: componentBridge.componentStack,
        sourceCandidates: componentBridge.sourceCandidates,
        componentStackSource: componentBridge.componentStackSource,
        componentStackConfidence: componentBridge.componentStackConfidence,
        boundingBox: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        },
        computedStyle: getSimpleComputedStyle(element),
        context: buildContext(element),
      };
    }`;
  }

  private buildRemoveAnnotationScript(): string {
    return `function(annotationId) {
      const id = String(annotationId || "");
      if (!id) return false;
      const host = document.getElementById("__tech_cc_hub_annotation_host__");
      const root = host && host.shadowRoot;
      const layer = root
        ? root.getElementById("__tech_cc_hub_annotation_layer__")
        : document.getElementById("__tech_cc_hub_annotation_layer__");
      if (layer) {
        Array.from(layer.querySelectorAll("[data-annotation-id]")).forEach(function(node) {
          if (node.dataset && node.dataset.annotationId === id) {
            node.remove();
          }
        });
      }
      if (window.__techCcHubAnnotations && typeof window.__techCcHubAnnotations.delete === "function") {
        window.__techCcHubAnnotations.delete(id);
      }
      return true;
    }`;
  }

  private buildClearAnnotationsScript(): string {
    return `function() {
      const host = document.getElementById("__tech_cc_hub_annotation_host__");
      const root = host && host.shadowRoot;
      const layer = root
        ? root.getElementById("__tech_cc_hub_annotation_layer__")
        : document.getElementById("__tech_cc_hub_annotation_layer__");
      if (window.__techCcHubAnnotationHandler) {
        document.removeEventListener("click", window.__techCcHubAnnotationHandler, true);
        window.__techCcHubAnnotationHandler = null;
      }
      if (window.__techCcHubAnnotationHoverHandler) {
        document.removeEventListener("mousemove", window.__techCcHubAnnotationHoverHandler, true);
        window.__techCcHubAnnotationHoverHandler = null;
      }
      if (window.__techCcHubAnnotationScrollHandler) {
        window.removeEventListener("scroll", window.__techCcHubAnnotationScrollHandler, true);
        document.removeEventListener("scroll", window.__techCcHubAnnotationScrollHandler, true);
        window.__techCcHubAnnotationScrollHandler = null;
      }
      if (window.__techCcHubAnnotationResizeHandler) {
        window.removeEventListener("resize", window.__techCcHubAnnotationResizeHandler, true);
        window.__techCcHubAnnotationResizeHandler = null;
      }
      if (window.__techCcHubAnnotationSyncFrame) {
        cancelAnimationFrame(window.__techCcHubAnnotationSyncFrame);
        window.__techCcHubAnnotationSyncFrame = null;
      }
      if (window.__techCcHubAnnotations && typeof window.__techCcHubAnnotations.clear === "function") {
        window.__techCcHubAnnotations.clear();
      }
      if (layer) {
        Array.from(layer.querySelectorAll(".__tech_cc_hub_outline,.__tech_cc_hub_marker,.__tech_cc_hub_comment,.__tech_cc_hub_background,.__tech_cc_hub_hover,.__tech_cc_hub_hover_card")).forEach(function(node) {
          node.remove();
        });
        layer.remove();
      }
      const style = root
        ? root.getElementById("__tech_cc_hub_annotation_style__")
        : document.getElementById("__tech_cc_hub_annotation_style__");
      if (style) style.remove();
      if (host) host.remove();
      return true;
    }`;
  }

  // Source: chrome-devtools-mcp/src/tools/input.ts (drag)
  private buildDragScript(): string {
    return `function(input) {
      try {
        const findElement = function(uid, strategy) {
          if (strategy === "ref" || strategy === "auto") {
            var el = document.querySelector("[data-cc-hub-ref='" + CSS.escape(uid) + "']");
            if (el) return el;
          }
          if (strategy === "selector" || strategy === "auto") {
            try { var el2 = document.querySelector(uid); if (el2) return el2; } catch(e) {}
          }
          if (strategy === "xpath") {
            try {
              var result = document.evaluate(uid, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
              if (result.singleNodeValue) return result.singleNodeValue;
            } catch(e) {}
          }
          return null;
        };
        var fromEl = findElement(input.from_uid, input.strategy);
        var toEl = findElement(input.to_uid, input.strategy);
        if (!fromEl) return { success: false, error: "拖拽源元素未找到" };
        if (!toEl) return { success: false, error: "拖拽目标元素未找到" };
        var fromRect = fromEl.getBoundingClientRect();
        var toRect = toEl.getBoundingClientRect();
        var fromX = fromRect.left + fromRect.width / 2;
        var fromY = fromRect.top + fromRect.height / 2;
        var toX = toRect.left + toRect.width / 2;
        var toY = toRect.top + toRect.height / 2;
        fromEl.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: fromX, clientY: fromY, button: 0 }));
        fromEl.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, clientX: fromX, clientY: fromY, button: 0 }));
        var steps = 10;
        for (var i = 1; i <= steps; i++) {
          var x = fromX + (toX - fromX) * (i / steps);
          var y = fromY + (toY - fromY) * (i / steps);
          document.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: x, clientY: y }));
          document.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: x, clientY: y }));
        }
        toEl.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, clientX: toX, clientY: toY, button: 0 }));
        toEl.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, clientX: toX, clientY: toY, button: 0 }));
        return { success: true };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    }`;
  }

  // Source: chrome-devtools-mcp/src/tools/input.ts (upload_file — element locator)
  private buildUploadFileScript(): string {
    return `function(input) {
      try {
        var el = null;
        if (input.strategy === "ref" || input.strategy === "auto") {
          el = document.querySelector("[data-cc-hub-ref='" + CSS.escape(input.target) + "']");
        }
        if (!el && (input.strategy === "selector" || input.strategy === "auto")) {
          try { el = document.querySelector(input.target); } catch(e) {}
        }
        if (!el && input.strategy === "xpath") {
          try {
            var result = document.evaluate(input.target, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            el = result.singleNodeValue;
          } catch(e) {}
        }
        if (!el) return { success: false, error: "文件上传元素未找到" };
        if (el.tagName !== "INPUT" || el.type !== "file") {
          return { success: false, error: "目标元素不是文件输入元素 (input[type=file])" };
        }
        // Mark the element with a unique attribute for CDP DOM.setFileInputFiles targeting
        if (input.markId) {
          el.setAttribute("data-cc-hub-upload", input.markId);
        }
        return { success: true };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    }`;
  }
}
