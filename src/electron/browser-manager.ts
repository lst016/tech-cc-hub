import { BrowserView, BrowserWindow, type WebContents } from "electron";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { buildBrowserWorkbenchWebPreferences } from "./libs/browser-workbench-session.js";
import { getBrowserWorkbenchPreloadPath } from "./pathResolver.js";
import {
  sanitizeBrowserWorkbenchBounds,
  shouldDetachBrowserWorkbenchForBounds,
} from "./libs/browser-workbench-bounds.js";

export type BrowserWorkbenchBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
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
  requestPostDataTruncated?: boolean;
  responseBody?: string;
  responseBodyBase64Encoded?: boolean;
  responseBodyTruncated?: boolean;
  bodyUnavailableReason?: string;
  errorText?: string;
  fromDiskCache?: boolean;
  fromServiceWorker?: boolean;
  startedAt: number;
  finishedAt?: number;
  durationMs?: number;
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
  action: BrowserWorkbenchMouseInput["action"];
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
  removed?: boolean;
  createdAt: number;
  point: { x: number; y: number };
  domHint?: BrowserWorkbenchDomHint;
};

export type BrowserWorkbenchEvent =
  | { type: "browser.state"; payload: BrowserWorkbenchState; sessionId?: string }
  | { type: "browser.console"; payload: BrowserWorkbenchConsoleLog; sessionId?: string }
  | { type: "browser.annotation"; payload: BrowserWorkbenchAnnotation; sessionId?: string };

const ANNOTATION_PREFIX = "__TECH_CC_HUB_ANNOTATION__";
const BROWSER_WORKBENCH_ANNOTATION_CHANNEL = "browser-workbench-annotation";
const MAX_NETWORK_LOGS = 200;
const DEFAULT_NETWORK_LOG_LIMIT = 50;
const MAX_NETWORK_BODY_CHARS = 64_000;
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
  private listeners = new Set<(event: BrowserWorkbenchEvent) => void>();

  constructor(private readonly window: BrowserWindow, private readonly sessionId?: string) {}

  open(url: string): BrowserWorkbenchState {
    const targetUrl = normalizeUrl(url);
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
    void view.webContents.loadURL(targetUrl);
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
        const next: BrowserWorkbenchNetworkLog = { ...entry };
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
      const result: BrowserWorkbenchEvalResult = {
        url: this.view.webContents.getURL(),
        title: this.view.webContents.getTitle(),
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
      return { success: false, result, error: result.error };
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
        void view.webContents.loadURL(url);
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
    view.webContents.on("did-navigate", () => this.emitState());
    view.webContents.on("did-navigate-in-page", () => this.emitState());
    view.webContents.on("did-finish-load", () => {
      if (this.annotationMode) {
        void this.installAnnotationScript();
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

  private clearNetworkLogs(): void {
    this.networkLogs = [];
    this.networkLogsByRequestId.clear();
  }

  private handleConsoleMessage(level: unknown, message: string, line?: number, sourceId?: string): void {
    if (message.startsWith(ANNOTATION_PREFIX)) {
      this.handleAnnotationMessage(message.slice(ANNOTATION_PREFIX.length));
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
      function ensureLayer() {
        let layer = document.getElementById("__tech_cc_hub_annotation_layer__");
        if (layer) {
          layer.hidden = false;
          return layer;
        }
        const style = document.createElement("style");
        style.id = "__tech_cc_hub_annotation_style__";
        style.textContent = [
          "#__tech_cc_hub_annotation_layer__{position:fixed;inset:0;z-index:2147483647;isolation:isolate;pointer-events:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1f2937}",
          ".__tech_cc_hub_hover{position:fixed;z-index:10;border:2px solid #1683ff;background:rgba(22,131,255,.06);box-sizing:border-box;pointer-events:none}",
          ".__tech_cc_hub_marker{position:fixed;z-index:40;width:28px;height:28px;border:1px solid rgba(255,255,255,.66);border-radius:999px;background:#1683ff;color:white;display:grid;place-items:center;font-size:13px;font-weight:800;box-shadow:0 8px 24px rgba(22,131,255,.36);pointer-events:auto;cursor:pointer;outline:none}",
          ".__tech_cc_hub_marker:hover,.__tech_cc_hub_marker:focus,.__tech_cc_hub_marker:focus-visible{background:#1683ff;color:white;box-shadow:0 8px 24px rgba(22,131,255,.36);outline:none}",
          ".__tech_cc_hub_outline{position:fixed;z-index:20;border:2px solid #1683ff;background:rgba(22,131,255,.08);box-sizing:border-box;pointer-events:none}",
          ".__tech_cc_hub_comment{position:fixed;z-index:30;display:grid;grid-template-columns:minmax(0,1fr) 34px;grid-template-rows:1fr 1fr;align-items:center;gap:6px 10px;width:min(440px,calc(100vw - 32px));height:92px;border:1px solid rgba(15,23,42,.1);border-radius:18px;background:rgba(255,255,255,.96);box-shadow:0 12px 34px rgba(15,23,42,.16);padding:10px 12px 10px 42px;pointer-events:auto}",
          ".__tech_cc_hub_comment[hidden]{display:none}",
          ".__tech_cc_hub_comment input{min-width:0;flex:1;border:0;outline:0;background:transparent;font-size:16px;color:#1f2937}",
          ".__tech_cc_hub_comment input::placeholder{color:#b9c0ca}",
          ".__tech_cc_hub_problem{grid-column:1;grid-row:1;border-bottom:1px solid rgba(15,23,42,.08)!important}",
          ".__tech_cc_hub_expectation{grid-column:1;grid-row:2;font-size:14px!important}",
          ".__tech_cc_hub_submit{grid-column:2;grid-row:1/3;display:grid;place-items:center;width:34px;height:34px;border:0;border-radius:999px;background:#1683ff;color:white;font-size:18px;font-weight:800;cursor:pointer;box-shadow:0 8px 18px rgba(22,131,255,.24)}",
          ".__tech_cc_hub_submit:disabled{background:#cbd5e1;box-shadow:none;cursor:default}",
          ".__tech_cc_hub_background{position:fixed;z-index:50;right:14px;top:14px;max-width:min(420px, calc(100vw - 40px));max-height:min(360px, calc(100vh - 28px));padding:10px 12px;border:1px solid #cbd5e1;background:rgba(255,255,255,0.98);border-radius:16px;box-shadow:0 16px 38px rgba(15,23,42,0.22);font-size:12px;line-height:1.45;color:#1f2937;overflow:hidden;display:none;pointer-events:auto;backdrop-filter:blur(6px)}",
          ".__tech_cc_hub_background[hidden]{display:none}",
          ".__tech_cc_hub_background-header{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;padding-bottom:6px;margin-bottom:8px;border-bottom:1px solid rgba(15,23,42,0.12)}",
          ".__tech_cc_hub_background-close{display:grid;place-items:center;width:20px;height:20px;border-radius:999px;border:1px solid #cbd5e1;background:#fff;line-height:1;font-size:12px;cursor:pointer}",
          ".__tech_cc_hub_background pre{margin:0;max-height:264px;overflow:auto;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;padding:8px;color:#334155;font-size:11px;white-space:pre-wrap;word-break:break-all}",
        ].join("\\n");
        document.documentElement.appendChild(style);
        layer = document.createElement("div");
        layer.id = "__tech_cc_hub_annotation_layer__";
        document.documentElement.appendChild(layer);
        return layer;
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
        const layer = document.getElementById("__tech_cc_hub_annotation_layer__");
        const hover = layer && layer.querySelector(".__tech_cc_hub_hover");
        if (hover) hover.remove();
      }
      function clearNativeAnnotationTitles() {
        const layer = document.getElementById("__tech_cc_hub_annotation_layer__");
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
          const preferredLeft = box ? box.x + Math.min(96, Math.max(24, box.width * 0.2)) : point.x + 18;
          const preferredTop = box ? box.y + Math.min(14, Math.max(0, box.height - 10)) : point.y + 18;
          const placement = placeWithinViewport(preferredLeft, preferredTop, Math.min(440, window.innerWidth - 32), 92);
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
      function updateHover(point) {
        const layer = ensureLayer();
        let hover = layer.querySelector(".__tech_cc_hub_hover");
        if (!hover) {
          hover = document.createElement("div");
          hover.className = "__tech_cc_hub_hover";
          layer.appendChild(hover);
        }
        const domHint = inspectAt(point);
        const box = domHint && domHint.boundingBox;
        if (!box || box.width <= 0 || box.height <= 0) {
          hover.style.display = "none";
          return;
        }
        hover.style.display = "block";
        hover.style.left = box.x + "px";
        hover.style.top = box.y + "px";
        hover.style.width = box.width + "px";
        hover.style.height = box.height + "px";
      }
      function placeWithinViewport(left, top, width, height) {
        return {
          left: Math.max(12, Math.min(left, window.innerWidth - width - 12)),
          top: Math.max(12, Math.min(top, window.innerHeight - height - 12)),
        };
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
        const preferredLeft = box ? box.x + Math.min(96, Math.max(24, box.width * 0.2)) : annotation.point.x + 18;
        const preferredTop = box ? box.y + Math.min(14, Math.max(0, box.height - 10)) : annotation.point.y + 18;
        const placement = placeWithinViewport(preferredLeft, preferredTop, Math.min(440, window.innerWidth - 32), 92);
        comment.style.left = placement.left + "px";
        comment.style.top = placement.top + "px";
        comment.dataset.annotationId = annotation.id;
        comment.dataset.annotationKey = annotation.key;
        const input = document.createElement("input");
        input.className = "__tech_cc_hub_problem";
        input.placeholder = "问题描述...";
        input.value = annotation.comment || "";
        comment.appendChild(input);
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
        function submitComment() {
          annotation.comment = input.value.trim();
          annotation.expectation = expectationInput.value.trim();
          emitAnnotation(annotation);
          comment.hidden = true;
        }
        function updateSubmitState() {
          annotation.comment = input.value;
          annotation.expectation = expectationInput.value;
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
        const layer = document.getElementById("__tech_cc_hub_annotation_layer__");
        if (layer) layer.hidden = true;
        return true;
      }
      ensureLayer().hidden = false;
      window.__techCcHubAnnotationHoverHandler = function(event) {
        if (event.target && event.target.closest && event.target.closest("#__tech_cc_hub_annotation_layer__")) {
          return;
        }
        updateHover({ x: event.clientX, y: event.clientY });
      };
      window.__techCcHubAnnotationHandler = function(event) {
        if (event.target && event.target.closest && event.target.closest("#__tech_cc_hub_annotation_layer__")) {
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
        context: buildContext(element),
      };
    }`;
  }

  private buildRemoveAnnotationScript(): string {
    return `function(annotationId) {
      const id = String(annotationId || "");
      if (!id) return false;
      const layer = document.getElementById("__tech_cc_hub_annotation_layer__");
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
      const layer = document.getElementById("__tech_cc_hub_annotation_layer__");
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
      if (layer) layer.remove();
      const style = document.getElementById("__tech_cc_hub_annotation_style__");
      if (style) style.remove();
      return true;
    }`;
  }
}
