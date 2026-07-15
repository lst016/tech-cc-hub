export type BrowserRenderedSemanticKind = "accessibility" | "chart" | "scene" | "terminal" | "text" | "unknown";

export type BrowserRenderedContentInput = {
  selector?: string;
  maxSurfaces?: number;
  maxChars?: number;
  includeSvg?: boolean;
};

export type NormalizedBrowserRenderedContentInput = {
  selector?: string;
  maxSurfaces: number;
  maxChars: number;
  includeSvg: boolean;
};

export type BrowserRenderedSemantic = {
  provider: string;
  kind: BrowserRenderedSemanticKind;
  text?: string;
  data?: unknown;
  truncated?: boolean;
};

export type BrowserRenderedSurface = {
  selector?: string;
  tagName: "canvas" | "svg";
  width?: number;
  height?: number;
  clientWidth?: number;
  clientHeight?: number;
  visible?: boolean;
  attributes?: Record<string, string>;
  hints?: string[];
  semantic: boolean;
  semantics: BrowserRenderedSemantic[];
};

export type BrowserRenderedFrameExtraction = {
  surfaces: BrowserRenderedSurface[];
  warnings: string[];
};

export type BrowserRenderedContentResult = {
  url: string;
  title?: string;
  framesScanned: number;
  framesFailed: number;
  surfaceCount: number;
  semanticSurfaceCount: number;
  surfaces: Array<BrowserRenderedSurface & {
    frameUrl: string;
    frameName?: string;
  }>;
  fingerprint: string;
  warnings: string[];
};

const DEFAULT_MAX_SURFACES = 20;
const MAX_MAX_SURFACES = 50;
const DEFAULT_MAX_CHARS = 60_000;
const MAX_MAX_CHARS = 200_000;

function clampInteger(value: number | undefined, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(value!)));
}

export function normalizeBrowserRenderedContentInput(
  input: BrowserRenderedContentInput = {},
): NormalizedBrowserRenderedContentInput {
  const selector = input.selector?.trim();
  return {
    maxSurfaces: clampInteger(input.maxSurfaces, DEFAULT_MAX_SURFACES, 1, MAX_MAX_SURFACES),
    maxChars: clampInteger(input.maxChars, DEFAULT_MAX_CHARS, 1_000, MAX_MAX_CHARS),
    includeSvg: input.includeSvg !== false,
    ...(selector ? { selector } : {}),
  };
}

export function createBrowserRenderedContentFingerprint(
  surfaces: ReadonlyArray<BrowserRenderedSurface & { frameUrl?: string; frameName?: string }>,
): string {
  const payload = surfaces.map((surface) => JSON.stringify({
    frameUrl: surface.frameUrl ?? "",
    frameName: surface.frameName ?? "",
    selector: surface.selector ?? "",
    tagName: surface.tagName,
    width: surface.width,
    height: surface.height,
    semantics: surface.semantics.map((semantic) => ({
      provider: semantic.provider,
      kind: semantic.kind,
      text: semantic.text ?? "",
      data: semantic.data,
    })),
  })).join("\u0001");
  let hash = 0x811c9dc5;
  for (let index = 0; index < payload.length; index += 1) {
    hash ^= payload.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `rendered-${(hash >>> 0).toString(16).padStart(8, "0")}-${payload.length}`;
}

export function buildBrowserRenderedContentExpression(input: BrowserRenderedContentInput = {}): string {
  const normalized = normalizeBrowserRenderedContentInput(input);
  return `(${readBrowserRenderedFrame.toString()})(${JSON.stringify(normalized)})`;
}

// This function is stringified and executed inside a page frame. Keep it self-contained.
function readBrowserRenderedFrame(input: NormalizedBrowserRenderedContentInput): BrowserRenderedFrameExtraction {
  type UnknownRecord = Record<string, unknown>;
  type CustomProvider = {
    name?: unknown;
    match?: unknown;
    extract?: unknown;
  };

  const warnings: string[] = [];
  let remainingChars = input.maxChars;
  const isObjectLike = (value: unknown): value is UnknownRecord => (
    (typeof value === "object" && value !== null) || typeof value === "function"
  );
  const finiteNumber = (value: unknown): number | undefined => (
    typeof value === "number" && Number.isFinite(value) ? value : undefined
  );
  const readProperty = (value: unknown, key: string): unknown => {
    if (!isObjectLike(value)) return undefined;
    try {
      return value[key];
    } catch {
      return undefined;
    }
  };

  const sanitize = (
    value: unknown,
    depth = 0,
    seen = new WeakSet<object>(),
    budget = { items: 0 },
  ): unknown => {
    if (value === null || typeof value === "boolean" || typeof value === "number") return value;
    if (typeof value === "string") return value.length > 4_000 ? `${value.slice(0, 4_000)}…` : value;
    if (typeof value === "bigint") return String(value);
    if (!isObjectLike(value) || depth >= 6 || budget.items >= 800) return undefined;
    if (seen.has(value as object)) return "[Circular]";
    seen.add(value as object);
    budget.items += 1;
    if (Array.isArray(value)) {
      return value.slice(0, 200).map((item) => sanitize(item, depth + 1, seen, budget));
    }
    const output: UnknownRecord = {};
    let descriptors: PropertyDescriptorMap = {};
    try {
      descriptors = Object.getOwnPropertyDescriptors(value);
    } catch {
      return undefined;
    }
    for (const [key, descriptor] of Object.entries(descriptors).slice(0, 100)) {
      if (!("value" in descriptor) || typeof descriptor.value === "function") continue;
      const sanitized = sanitize(descriptor.value, depth + 1, seen, budget);
      if (sanitized !== undefined) output[key] = sanitized;
    }
    return output;
  };

  const semanticFrom = (
    provider: string,
    kind: BrowserRenderedSemanticKind,
    rawData?: unknown,
    preferredText?: string,
  ): BrowserRenderedSemantic | undefined => {
    const data = rawData === undefined ? undefined : sanitize(rawData);
    let text = preferredText?.trim();
    if (!text && data !== undefined) {
      try {
        text = JSON.stringify(data);
      } catch {
        text = undefined;
      }
    }
    if (!text && data === undefined) return undefined;
    let truncated = false;
    if (text && text.length > remainingChars) {
      text = text.slice(0, Math.max(0, remainingChars));
      truncated = true;
    }
    if (text) remainingChars = Math.max(0, remainingChars - text.length);
    return {
      provider: provider.slice(0, 80),
      kind,
      ...(text ? { text } : {}),
      ...(data !== undefined ? { data } : {}),
      ...(truncated ? { truncated: true } : {}),
    };
  };

  const queryAllDeep = (root: ParentNode, selector: string): Element[] => {
    const matches = new Set<Element>();
    const roots: ParentNode[] = [root];
    const visited = new WeakSet<object>();
    let inspectedRoots = 0;
    while (roots.length > 0 && inspectedRoots < 100) {
      const current = roots.shift()!;
      if (visited.has(current as object)) continue;
      visited.add(current as object);
      inspectedRoots += 1;
      let selected: Element[] = [];
      let descendants: Element[] = [];
      try {
        selected = Array.from(current.querySelectorAll(selector));
        descendants = selector === "*" ? selected : Array.from(current.querySelectorAll("*"));
      } catch {
        continue;
      }
      selected.forEach((element) => matches.add(element));
      for (const element of descendants) {
        const shadowRoot = (element as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
        if (shadowRoot) roots.push(shadowRoot);
      }
    }
    return [...matches];
  };

  const isSurface = (element: Element): element is HTMLCanvasElement | SVGElement => {
    const tagName = String(element.tagName ?? "").toLowerCase();
    return tagName === "canvas" || (input.includeSvg && tagName === "svg");
  };
  const findSurfaces = (): Array<HTMLCanvasElement | SVGElement> => {
    const defaultSelector = input.includeSvg ? "canvas,svg" : "canvas";
    try {
      if (!input.selector) return queryAllDeep(document, defaultSelector).filter(isSurface).slice(0, input.maxSurfaces);
      const selected = queryAllDeep(document, input.selector);
      const surfaces = new Set<HTMLCanvasElement | SVGElement>();
      for (const element of selected) {
        if (isSurface(element)) surfaces.add(element);
        for (const nested of queryAllDeep(element, defaultSelector)) {
          if (isSurface(nested)) surfaces.add(nested);
        }
      }
      return [...surfaces].slice(0, input.maxSurfaces);
    } catch (error) {
      warnings.push(`Rendered-surface selector failed: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  };

  const elementSelector = (element: Element): string | undefined => {
    if (element.id) return `#${element.id}`;
    const classes = Array.from(element.classList ?? []).filter(Boolean).slice(0, 3);
    const tagName = String(element.tagName ?? "").toLowerCase();
    return classes.length > 0 ? `${tagName}.${classes.join(".")}` : tagName || undefined;
  };
  const attributesFor = (element: Element): Record<string, string> => {
    const attributes: Record<string, string> = {};
    for (const name of ["id", "class", "role", "aria-label", "aria-description", "aria-describedby", "title", "data-renderer"]) {
      try {
        const value = element.getAttribute?.(name);
        if (value) attributes[name] = value;
      } catch {
        // Attribute metadata is best-effort.
      }
    }
    const dataset = (element as HTMLElement).dataset;
    if (dataset) {
      for (const [key, value] of Object.entries(dataset).slice(0, 30)) {
        if (value !== undefined) attributes[`data-${key}`] = value;
      }
    }
    return attributes;
  };
  const accessibilityText = (attributes: Record<string, string>): string => {
    const values: Array<string | undefined> = [attributes["aria-label"], attributes["aria-description"], attributes.title];
    const describedBy = attributes["aria-describedby"];
    if (describedBy) {
      for (const id of describedBy.split(/\s+/u).slice(0, 10)) {
        try {
          values.push(document.getElementById(id)?.textContent?.trim());
        } catch {
          // Ignore broken references.
        }
      }
    }
    return values.filter((value): value is string => Boolean(value)).join("\n");
  };

  const addPublicLibrarySemantics = (element: Element, semantics: BrowserRenderedSemantic[]): void => {
    const canvas = String(element.tagName).toLowerCase() === "canvas" ? element as HTMLCanvasElement : undefined;
    const existingProviders = new Set(semantics.map((semantic) => semantic.provider));
    const add = (semantic: BrowserRenderedSemantic | undefined) => {
      if (!semantic || existingProviders.has(semantic.provider)) return;
      semantics.push(semantic);
      existingProviders.add(semantic.provider);
    };

    const Chart = readProperty(window, "Chart");
    const getChart = readProperty(Chart, "getChart");
    if (canvas && typeof getChart === "function") {
      try {
        const chart = getChart.call(Chart, canvas);
        if (isObjectLike(chart)) {
          add(semanticFrom("chartjs", "chart", {
            type: readProperty(readProperty(chart, "config"), "type"),
            data: readProperty(chart, "data"),
            options: readProperty(chart, "options"),
          }));
        }
      } catch {
        // Continue with other providers.
      }
    }

    const echarts = readProperty(window, "echarts");
    const getInstanceByDom = readProperty(echarts, "getInstanceByDom");
    if (typeof getInstanceByDom === "function") {
      let candidate: Element | null = element;
      for (let depth = 0; candidate && depth < 5; depth += 1) {
        try {
          const chart = getInstanceByDom.call(echarts, candidate);
          const getOption = readProperty(chart, "getOption");
          if (typeof getOption === "function") {
            add(semanticFrom("echarts", "chart", getOption.call(chart)));
            break;
          }
        } catch {
          // Try an ancestor container.
        }
        candidate = candidate.parentElement;
      }
    }

    const Konva = readProperty(window, "Konva");
    const stages = readProperty(Konva, "stages");
    if (Array.isArray(stages)) {
      for (const stage of stages.slice(0, 30)) {
        try {
          const container = typeof readProperty(stage, "container") === "function"
            ? (readProperty(stage, "container") as () => unknown).call(stage)
            : undefined;
          const matches = container === element
            || (isObjectLike(container) && typeof container.contains === "function" && container.contains(element));
          const toJSON = readProperty(stage, "toJSON");
          if (matches && typeof toJSON === "function") {
            const serialized = toJSON.call(stage);
            add(semanticFrom("konva", "scene", typeof serialized === "string" ? JSON.parse(serialized) : serialized));
            break;
          }
        } catch {
          // Continue with other stages.
        }
      }
    }

    const customProviders = readProperty(window, "__TECHCC_RENDERED_CONTENT_PROVIDERS__");
    if (Array.isArray(customProviders)) {
      for (const rawProvider of customProviders.slice(0, 20)) {
        const provider = rawProvider as CustomProvider;
        const name = typeof provider.name === "string" ? provider.name.trim() : "custom";
        if (typeof provider.match !== "function" || typeof provider.extract !== "function") continue;
        try {
          if (!provider.match(element)) continue;
          const extracted = provider.extract(element);
          const extractedRecord: UnknownRecord = isObjectLike(extracted) ? extracted : { data: extracted };
          const kindValue = extractedRecord.kind;
          const kind: BrowserRenderedSemanticKind = kindValue === "chart" || kindValue === "scene"
            || kindValue === "terminal" || kindValue === "text" || kindValue === "accessibility"
            ? kindValue
            : "unknown";
          add(semanticFrom(
            name || "custom",
            kind,
            extractedRecord.data,
            typeof extractedRecord.text === "string" ? extractedRecord.text : undefined,
          ));
        } catch (error) {
          warnings.push(`Rendered-content provider ${name || "custom"} failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    if (!canvas) return;
    let descriptors: PropertyDescriptorMap = {};
    try {
      descriptors = Object.getOwnPropertyDescriptors(window);
    } catch {
      return;
    }
    const queue: Array<{ value: UnknownRecord; depth: number }> = [];
    const candidatePattern = /canvas|chart|stage|scene|renderer|fabric|konva|pixi|three|app/i;
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (candidatePattern.test(key) && "value" in descriptor && isObjectLike(descriptor.value)) {
        queue.push({ value: descriptor.value, depth: 0 });
      }
    }
    const visited = new WeakSet<object>();
    let inspected = 0;
    while (queue.length > 0 && inspected < 240) {
      const entry = queue.shift()!;
      if (visited.has(entry.value as object)) continue;
      visited.add(entry.value as object);
      inspected += 1;
      try {
        const lowerCanvas = readProperty(entry.value, "lowerCanvasEl");
        const upperCanvas = readProperty(entry.value, "upperCanvasEl");
        const toJSON = readProperty(entry.value, "toJSON");
        if ((lowerCanvas === canvas || upperCanvas === canvas) && typeof toJSON === "function") {
          add(semanticFrom("fabric", "scene", toJSON.call(entry.value)));
        }
        const domElement = readProperty(entry.value, "domElement");
        if (domElement === canvas) {
          add(semanticFrom("three-renderer", "scene", {
            info: readProperty(entry.value, "info"),
            capabilities: readProperty(entry.value, "capabilities"),
          }));
        }
        const renderer = readProperty(entry.value, "renderer");
        const rendererCanvas = readProperty(renderer, "canvas") ?? readProperty(renderer, "view");
        if (rendererCanvas === canvas) {
          add(semanticFrom("pixi", "scene", {
            renderer: readProperty(renderer, "type"),
            stage: readProperty(entry.value, "stage"),
          }));
        }
      } catch {
        // Provider shape mismatches are expected during bounded discovery.
      }
      if (entry.depth >= 3) continue;
      let ownDescriptors: PropertyDescriptorMap = {};
      try {
        ownDescriptors = Object.getOwnPropertyDescriptors(entry.value);
      } catch {
        continue;
      }
      for (const [key, descriptor] of Object.entries(ownDescriptors).slice(0, 80)) {
        if (!("value" in descriptor) || !isObjectLike(descriptor.value)) continue;
        if (entry.depth === 0 || candidatePattern.test(key)) queue.push({ value: descriptor.value, depth: entry.depth + 1 });
      }
    }
  };

  const surfaces: BrowserRenderedSurface[] = [];
  for (const element of findSurfaces()) {
    if (remainingChars <= 0) break;
    const tagName = String(element.tagName).toLowerCase() as "canvas" | "svg";
    const attributes = attributesFor(element);
    const semantics: BrowserRenderedSemantic[] = [];
    const accessibleText = accessibilityText(attributes);
    if (accessibleText) {
      const semantic = semanticFrom("accessibility", "accessibility", undefined, accessibleText);
      if (semantic) semantics.push(semantic);
    }
    addPublicLibrarySemantics(element, semantics);
    const rect = (() => {
      try {
        return element.getBoundingClientRect();
      } catch {
        return undefined;
      }
    })();
    const identity = `${elementSelector(element) ?? ""} ${attributes.class ?? ""} ${attributes["data-renderer"] ?? ""}`.toLowerCase();
    const hints = ["xterm", "echarts", "chart", "konva", "fabric", "pixi", "three"]
      .filter((hint) => identity.includes(hint));
    surfaces.push({
      selector: elementSelector(element),
      tagName,
      ...(tagName === "canvas" && finiteNumber((element as HTMLCanvasElement).width) !== undefined
        ? { width: finiteNumber((element as HTMLCanvasElement).width) }
        : {}),
      ...(tagName === "canvas" && finiteNumber((element as HTMLCanvasElement).height) !== undefined
        ? { height: finiteNumber((element as HTMLCanvasElement).height) }
        : {}),
      ...(rect ? { clientWidth: Math.round(rect.width), clientHeight: Math.round(rect.height), visible: rect.width > 0 && rect.height > 0 } : {}),
      ...(Object.keys(attributes).length > 0 ? { attributes } : {}),
      ...(hints.length > 0 ? { hints } : {}),
      semantic: semantics.length > 0,
      semantics,
    });
  }

  if (surfaces.length === 0) warnings.push("No canvas, WebGL-backed canvas, or SVG rendered surfaces were found in this frame.");
  if (surfaces.length > 0 && !surfaces.some((surface) => surface.semantic)) {
    warnings.push("Rendered surfaces were found, but no accessibility data, public renderer API, custom provider, or structured scene owner exposed semantic content. Pixel capture is required for visual interpretation.");
  }
  if (remainingChars <= 0) warnings.push(`Rendered semantic text was capped at ${input.maxChars} characters.`);
  return { surfaces, warnings };
}
