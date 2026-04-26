import { BrowserView, BrowserWindow } from "electron";

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

export type BrowserWorkbenchDomHint = {
  tagName: string;
  role?: string;
  text?: string;
  ariaLabel?: string;
  selector?: string;
  path?: string;
  target?: { type: "text"; value: string } | { type: "image"; url: string; alt?: string };
  selectorCandidates: string[];
  boundingBox?: { x: number; y: number; width: number; height: number };
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

export type BrowserWorkbenchAnnotation = {
  id: string;
  url: string;
  title?: string;
  comment?: string;
  removed?: boolean;
  createdAt: number;
  point: { x: number; y: number };
  domHint?: BrowserWorkbenchDomHint;
};

export type BrowserWorkbenchEvent =
  | { type: "browser.state"; payload: BrowserWorkbenchState }
  | { type: "browser.console"; payload: BrowserWorkbenchConsoleLog }
  | { type: "browser.annotation"; payload: BrowserWorkbenchAnnotation };

const ANNOTATION_PREFIX = "__TECH_CC_HUB_ANNOTATION__";

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

function sanitizeBounds(bounds: BrowserWorkbenchBounds): BrowserWorkbenchBounds {
  return {
    x: Math.max(0, Math.round(bounds.x)),
    y: Math.max(0, Math.round(bounds.y)),
    width: Math.max(0, Math.round(bounds.width)),
    height: Math.max(0, Math.round(bounds.height)),
  };
}

export class BrowserWorkbenchManager {
  private view: BrowserView | null = null;
  private bounds: BrowserWorkbenchBounds = { x: 0, y: 0, width: 0, height: 0 };
  private logs: BrowserWorkbenchConsoleLog[] = [];
  private annotationMode = false;
  private listeners = new Set<(event: BrowserWorkbenchEvent) => void>();

  constructor(private readonly window: BrowserWindow) {}

  open(url: string): BrowserWorkbenchState {
    const view = this.ensureView();
    void view.webContents.loadURL(normalizeUrl(url));
    this.emitState();
    return this.getState();
  }

  close(): BrowserWorkbenchState {
    if (this.view) {
      this.window.removeBrowserView(this.view);
      this.view = null;
    }
    this.logs = [];
    this.annotationMode = false;
    this.emitState();
    return this.getState();
  }

  setBounds(bounds: BrowserWorkbenchBounds): BrowserWorkbenchState {
    this.bounds = sanitizeBounds(bounds);
    if (this.view) {
      this.view.setBounds(this.bounds);
    }
    return this.getState();
  }

  reload(): BrowserWorkbenchState {
    this.view?.webContents.reload();
    return this.getState();
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

  private ensureView(): BrowserView {
    if (this.view && !this.view.webContents.isDestroyed()) {
      this.window.setBrowserView(this.view);
      this.view.setBounds(this.bounds);
      return this.view;
    }

    const view = new BrowserView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
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

    view.webContents.on("did-start-loading", () => this.emitState());
    view.webContents.on("did-stop-loading", () => this.emitState());
    view.webContents.on("page-title-updated", () => this.emitState());
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

    return view;
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
    this.window.webContents.send("browser-event", JSON.stringify(event));
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  private async installAnnotationScript(): Promise<void> {
    if (!this.view || this.view.webContents.isDestroyed()) return;
    try {
      await this.view.webContents.executeJavaScript(
        `(${this.buildAnnotationScript()})(${JSON.stringify({ enabled: this.annotationMode, prefix: ANNOTATION_PREFIX })})`,
        true,
      );
    } catch {
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

  private buildAnnotationScript(): string {
      return `function(options) {
      const inspectAt = ${this.buildInspectScript()};
      function ensureLayer() {
        let layer = document.getElementById("__tech_cc_hub_annotation_layer__");
        if (layer) return layer;
        const style = document.createElement("style");
        style.id = "__tech_cc_hub_annotation_style__";
        style.textContent = [
          "#__tech_cc_hub_annotation_layer__{position:fixed;inset:0;z-index:2147483647;pointer-events:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1f2937}",
          ".__tech_cc_hub_hover{position:fixed;border:2px solid #1683ff;background:rgba(22,131,255,.06);box-sizing:border-box;pointer-events:none}",
          ".__tech_cc_hub_marker{position:fixed;width:28px;height:28px;border-radius:999px;background:#1683ff;color:white;display:grid;place-items:center;font-size:13px;font-weight:800;box-shadow:0 0 0 3px white,0 8px 24px rgba(22,131,255,.36);pointer-events:auto;cursor:pointer}",
          ".__tech_cc_hub_outline{position:fixed;border:2px solid #1683ff;background:rgba(22,131,255,.08);box-sizing:border-box;pointer-events:none}",
          ".__tech_cc_hub_comment{position:fixed;display:flex;align-items:center;gap:10px;width:min(420px,calc(100vw - 32px));height:54px;border:1px solid rgba(15,23,42,.1);border-radius:999px;background:rgba(255,255,255,.96);box-shadow:0 12px 34px rgba(15,23,42,.16);padding:0 12px 0 42px;pointer-events:auto}",
          ".__tech_cc_hub_comment[hidden]{display:none}",
          ".__tech_cc_hub_comment input{min-width:0;flex:1;border:0;outline:0;background:transparent;font-size:16px;color:#1f2937}",
          ".__tech_cc_hub_comment input::placeholder{color:#b9c0ca}",
          ".__tech_cc_hub_submit{display:grid;place-items:center;width:34px;height:34px;border:0;border-radius:999px;background:#1683ff;color:white;font-size:18px;font-weight:800;cursor:pointer;box-shadow:0 8px 18px rgba(22,131,255,.24)}",
          ".__tech_cc_hub_submit:disabled{background:#cbd5e1;box-shadow:none;cursor:default}",
          ".__tech_cc_hub_background{position:fixed;right:14px;top:14px;max-width:min(420px, calc(100vw - 40px));max-height:min(360px, calc(100vh - 28px));padding:10px 12px;border:1px solid #cbd5e1;background:rgba(255,255,255,0.98);border-radius:16px;box-shadow:0 16px 38px rgba(15,23,42,0.22);font-size:12px;line-height:1.45;color:#1f2937;overflow:hidden;display:none;pointer-events:auto;backdrop-filter:blur(6px)}",
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
        const panel = ensureBackgroundInfo();
        const pre = panel.querySelector(".__tech_cc_hub_background-content");
        if (!annotation || !pre) {
          panel.hidden = true;
          return;
        }
        const payload = {
          id: annotation.id,
          url: annotation.url,
          title: annotation.title,
          comment: annotation.comment || "",
          nodePosition: annotation.point,
          dom: annotation.domHint ? {
            tagName: annotation.domHint.tagName,
            role: annotation.domHint.role,
            text: annotation.domHint.text,
            ariaLabel: annotation.domHint.ariaLabel,
            selector: annotation.domHint.selector,
            selectorCandidates: annotation.domHint.selectorCandidates,
            path: annotation.domHint.path,
            target: annotation.domHint.target,
            boundingBox: annotation.domHint.boundingBox,
          } : undefined,
          timestamp: annotation.createdAt,
        };
        const text = JSON.stringify(payload, null, 2);
        panel.querySelector(".__tech_cc_hub_background-title").textContent = "背景信息 #" + annotation.id.slice(0, 8);
        pre.textContent = text;
        panel.hidden = false;
      }
      function clearBackgroundInfo() {
        const layer = ensureLayer();
        const panel = layer.querySelector(".__tech_cc_hub_background");
        if (panel) panel.hidden = true;
      }
      function uid() {
        if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
        return "ann-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
      }
      function emitAnnotation(annotation) {
        console.info(options.prefix + JSON.stringify(annotation));
      }
      function annotationKey(domHint, point) {
        const selector = domHint && domHint.selectorCandidates && domHint.selectorCandidates[0];
        const box = domHint && domHint.boundingBox;
        if (selector) return "selector:" + selector;
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
        if (box && box.width > 0 && box.height > 0) {
          const outline = document.createElement("div");
          outline.className = "__tech_cc_hub_outline";
          outline.style.left = box.x + "px";
          outline.style.top = box.y + "px";
          outline.style.width = box.width + "px";
          outline.style.height = box.height + "px";
          outline.dataset.annotationId = annotation.id;
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
        const comment = document.createElement("div");
        comment.className = "__tech_cc_hub_comment";
        const preferredLeft = box ? box.x + Math.min(96, Math.max(24, box.width * 0.2)) : annotation.point.x + 18;
        const preferredTop = box ? box.y + Math.min(14, Math.max(0, box.height - 10)) : annotation.point.y + 18;
        const placement = placeWithinViewport(preferredLeft, preferredTop, Math.min(420, window.innerWidth - 32), 54);
        comment.style.left = placement.left + "px";
        comment.style.top = placement.top + "px";
        comment.dataset.annotationId = annotation.id;
        comment.dataset.annotationKey = annotation.key;
        const input = document.createElement("input");
        input.placeholder = "添加评论...";
        input.value = annotation.comment || "";
        comment.appendChild(input);
        const submit = document.createElement("button");
        submit.type = "button";
        submit.className = "__tech_cc_hub_submit";
        submit.textContent = "➜";
        submit.setAttribute("aria-label", "保存评论");
        comment.appendChild(submit);
        function submitComment() {
          annotation.comment = input.value.trim();
          emitAnnotation(annotation);
          comment.hidden = true;
        }
        marker.addEventListener("click", function(event) {
          event.preventDefault();
          event.stopPropagation();
          showBackgroundInfo(annotation);
          comment.hidden = !comment.hidden;
          if (!comment.hidden) {
            input.value = annotation.comment || input.value;
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
        input.addEventListener("input", function() {
          annotation.comment = input.value;
          showBackgroundInfo(annotation);
          submit.disabled = !input.value.trim();
        });
        input.addEventListener("keydown", function(event) {
          if (event.key === "Enter") {
            event.preventDefault();
            submitComment();
          }
          if (event.key === "Escape") comment.hidden = true;
        });
        submit.disabled = !input.value.trim();
        layer.appendChild(marker);
        layer.appendChild(comment);
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
      if (!options.enabled) return true;
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
        drawAnnotation(annotation);
        showBackgroundInfo(annotation);
        emitAnnotation(annotation);
      };
      document.addEventListener("mousemove", window.__techCcHubAnnotationHoverHandler, true);
      document.addEventListener("click", window.__techCcHubAnnotationHandler, true);
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
      function textOf(element) {
        return (element.innerText || element.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 160);
      }
      function selectorCandidates(element) {
        const candidates = [];
        if (element.id) candidates.push("#" + cssEscape(element.id));
        const testId = element.getAttribute("data-testid");
        if (testId) candidates.push("[data-testid='" + String(testId).replace(/'/g, "\\\\'") + "']");
        const aria = element.getAttribute("aria-label");
        if (aria) candidates.push(element.tagName.toLowerCase() + "[aria-label='" + String(aria).replace(/'/g, "\\\\'") + "']");
        const classes = Array.from(element.classList || []).slice(0, 3).map(cssEscape);
        if (classes.length) candidates.push(element.tagName.toLowerCase() + "." + classes.join("."));
        candidates.push(element.tagName.toLowerCase());
        return candidates;
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
      const element = document.elementFromPoint(point.x, point.y);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      const candidates = selectorCandidates(element);
      return {
        tagName: element.tagName.toLowerCase(),
        role: element.getAttribute("role") || undefined,
        text: textOf(element) || undefined,
        ariaLabel: element.getAttribute("aria-label") || undefined,
        selector: candidates[0],
        path: pathOf(element),
        target: targetOf(element),
        selectorCandidates: candidates,
        boundingBox: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        },
      };
    }`;
  }
}
