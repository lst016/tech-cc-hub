export type BrowserTerminalReadScope = "visible" | "tail" | "all";
export type BrowserTerminalBufferTarget = "active" | "normal";

export type BrowserTerminalReadInput = {
  scope?: BrowserTerminalReadScope;
  maxLines?: number;
  maxChars?: number;
  buffer?: BrowserTerminalBufferTarget;
  targetPath?: string;
  selector?: string;
};

export type NormalizedBrowserTerminalReadInput = {
  scope: BrowserTerminalReadScope;
  maxLines: number;
  maxChars: number;
  buffer: BrowserTerminalBufferTarget;
  targetPath?: string;
  selector?: string;
};

export type BrowserTerminalCanvasInfo = {
  selector?: string;
  width: number;
  height: number;
  clientWidth?: number;
  clientHeight?: number;
  ariaLabel?: string;
  insideXterm: boolean;
};

export type BrowserTerminalExtraction = {
  source: "xterm-buffer" | "xterm-internal" | "xterm-debugger" | "xterm-accessibility" | "xterm-dom";
  targetPath?: string;
  selector?: string;
  visible?: boolean;
  text: string;
  lineCount: number;
  physicalLineCount?: number;
  startLine?: number;
  endLine?: number;
  truncated: boolean;
  truncatedStart?: boolean;
  truncatedEnd?: boolean;
  bufferType?: string;
  cols?: number;
  rows?: number;
  baseY?: number;
  viewportY?: number;
  cursorX?: number;
  cursorY?: number;
};

export type BrowserTerminalFrameExtraction = {
  readable: boolean;
  terminals: BrowserTerminalExtraction[];
  canvases: BrowserTerminalCanvasInfo[];
  warnings: string[];
};

export type BrowserTerminalReadResult = {
  url: string;
  title?: string;
  scope: BrowserTerminalReadScope;
  buffer: BrowserTerminalBufferTarget;
  framesScanned: number;
  framesFailed: number;
  readable: boolean;
  terminalCount: number;
  terminals: Array<BrowserTerminalExtraction & {
    frameUrl: string;
    frameName?: string;
  }>;
  canvasCount: number;
  canvases: Array<BrowserTerminalCanvasInfo & {
    frameUrl: string;
    frameName?: string;
  }>;
  fingerprint: string;
  warnings: string[];
};

const DEFAULT_MAX_LINES = 200;
const MAX_MAX_LINES = 2_000;
const DEFAULT_MAX_CHARS = 60_000;
const MAX_MAX_CHARS = 200_000;

function clampInteger(value: number | undefined, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(value!)));
}

export function normalizeBrowserTerminalReadInput(
  input: BrowserTerminalReadInput = {},
): NormalizedBrowserTerminalReadInput {
  const scope = input.scope === "visible" || input.scope === "all" ? input.scope : "tail";
  const buffer = input.buffer === "normal" ? "normal" : "active";
  const targetPath = input.targetPath?.trim();
  const selector = input.selector?.trim();
  return {
    scope,
    maxLines: clampInteger(input.maxLines, DEFAULT_MAX_LINES, 1, MAX_MAX_LINES),
    maxChars: clampInteger(input.maxChars, DEFAULT_MAX_CHARS, 1_000, MAX_MAX_CHARS),
    buffer,
    ...(targetPath ? { targetPath } : {}),
    ...(selector ? { selector } : {}),
  };
}

export function createBrowserTerminalFingerprint(
  terminals: ReadonlyArray<BrowserTerminalExtraction & { frameUrl?: string; frameName?: string }>,
): string {
  const semanticText = terminals.map((terminal) => [
    terminal.frameUrl ?? "",
    terminal.frameName ?? "",
    terminal.targetPath ?? terminal.selector ?? "",
    terminal.bufferType ?? "",
    terminal.text,
  ].join("\u0000")).join("\u0001");
  let hash = 0x811c9dc5;
  for (let index = 0; index < semanticText.length; index += 1) {
    hash ^= semanticText.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `xterm-${(hash >>> 0).toString(16).padStart(8, "0")}-${semanticText.length}`;
}

export function buildBrowserTerminalReadExpression(input: BrowserTerminalReadInput = {}): string {
  const normalized = normalizeBrowserTerminalReadInput(input);
  return `(${readBrowserTerminalFrame.toString()})(${JSON.stringify(normalized)})`;
}

// This function is stringified and executed in the inspected page. Keep every helper
// inside the function so the injected expression does not depend on Electron modules.
function readBrowserTerminalFrame(input: NormalizedBrowserTerminalReadInput): BrowserTerminalFrameExtraction {
  type UnknownRecord = Record<string, unknown>;
  type BufferLineLike = {
    isWrapped?: boolean;
    translateToString(trimRight?: boolean, startColumn?: number, endColumn?: number): string;
  };
  type BufferLike = {
    type?: string;
    length: number;
    baseY?: number;
    viewportY?: number;
    cursorX?: number;
    cursorY?: number;
    getLine(index: number): BufferLineLike | undefined;
  };
  type BufferResolution = {
    buffer: BufferLike;
    source: "xterm-buffer" | "xterm-internal";
  };

  const terminals: BrowserTerminalExtraction[] = [];
  const warnings: string[] = [];
  const seenBuffers = new WeakSet<object>();
  const scannedObjectDepths = new WeakMap<object, number>();
  const candidatePattern = /term|xterm|console|shell|ssh|win|app|vm|state|vue|react|fiber|component/i;
  const knownPaths = [input.targetPath, "term", "terminal", "xterm", "win.term"].filter(
    (value, index, values): value is string => Boolean(value) && values.indexOf(value) === index,
  );

  const isObjectLike = (value: unknown): value is UnknownRecord => (
    (typeof value === "object" && value !== null) || typeof value === "function"
  );
  const finiteNumber = (value: unknown): number | undefined => (
    typeof value === "number" && Number.isFinite(value) ? value : undefined
  );
  const isBufferLike = (value: unknown): value is BufferLike => {
    if (!isObjectLike(value)) return false;
    try {
      return Number.isFinite(value.length) && typeof value.getLine === "function";
    } catch {
      return false;
    }
  };

  const resolveBuffer = (candidate: unknown): BufferResolution | null => {
    if (!isObjectLike(candidate)) return null;
    try {
      const namespace = candidate.buffer;
      if (isObjectLike(namespace)) {
        const selected = input.buffer === "normal" ? namespace.normal : namespace.active;
        if (isBufferLike(selected)) return { buffer: selected, source: "xterm-buffer" };
      }
    } catch {
      // Some page objects expose throwing getters. Continue with bounded compatibility checks.
    }
    try {
      const core = candidate._core;
      if (!isObjectLike(core)) return null;
      const namespace = core.buffer;
      if (isObjectLike(namespace)) {
        const selected = input.buffer === "normal" ? namespace.normal : namespace.active;
        if (isBufferLike(selected)) return { buffer: selected, source: "xterm-internal" };
      }
      const bufferService = core._bufferService;
      if (isObjectLike(bufferService)) {
        const serviceNamespace = bufferService.buffer;
        if (isObjectLike(serviceNamespace)) {
          const selected = input.buffer === "normal" ? serviceNamespace.normal : serviceNamespace.active;
          if (isBufferLike(selected)) return { buffer: selected, source: "xterm-internal" };
        }
      }
    } catch {
      // Internal xterm layouts vary by version; absence is an expected fallback condition.
    }
    return null;
  };

  const trimTrailingEmptyLines = (lines: string[]): string[] => {
    let end = lines.length;
    while (end > 0 && !lines[end - 1].trim()) end -= 1;
    return lines.slice(0, end);
  };

  const addBufferTerminal = (candidate: unknown, targetPath?: string): boolean => {
    const resolved = resolveBuffer(candidate);
    if (!resolved || seenBuffers.has(resolved.buffer as object)) return false;
    seenBuffers.add(resolved.buffer as object);

    const { buffer, source } = resolved;
    const length = Math.max(0, Math.trunc(finiteNumber(buffer.length) ?? 0));
    const candidateRecord = isObjectLike(candidate) ? candidate : {};
    const cols = finiteNumber(candidateRecord.cols);
    const rows = finiteNumber(candidateRecord.rows);
    const viewportY = Math.max(0, Math.trunc(finiteNumber(buffer.viewportY) ?? 0));
    let startLine = 0;
    let endExclusive = length;
    if (input.scope === "visible") {
      startLine = Math.min(length, viewportY);
      endExclusive = Math.min(length, startLine + Math.max(1, Math.trunc(rows ?? 1)));
    } else if (input.scope === "tail") {
      startLine = Math.max(0, length - input.maxLines);
    }
    if (input.scope === "all" && endExclusive - startLine > input.maxLines) {
      endExclusive = startLine + input.maxLines;
    } else if (input.scope !== "all" && endExclusive - startLine > input.maxLines) {
      startLine = endExclusive - input.maxLines;
    }

    const logicalLines: string[] = [];
    let physicalLineCount = 0;
    for (let index = startLine; index < endExclusive; index += 1) {
      let line: BufferLineLike | undefined;
      try {
        line = buffer.getLine(index);
      } catch {
        continue;
      }
      if (!line) continue;
      physicalLineCount += 1;
      let text = "";
      try {
        text = String(line.translateToString(true));
      } catch {
        continue;
      }
      if (line.isWrapped && logicalLines.length > 0) {
        logicalLines[logicalLines.length - 1] += text;
      } else {
        logicalLines.push(text);
      }
    }

    const trimmedLines = trimTrailingEmptyLines(logicalLines);
    let text = trimmedLines.join("\n");
    let truncatedStart = startLine > 0;
    let truncatedEnd = endExclusive < length;
    if (text.length > input.maxChars) {
      if (input.scope === "tail") {
        text = text.slice(-input.maxChars);
        truncatedStart = true;
      } else {
        text = text.slice(0, input.maxChars);
        truncatedEnd = true;
      }
    }

    terminals.push({
      source,
      ...(targetPath ? { targetPath } : {}),
      text,
      lineCount: trimmedLines.length,
      physicalLineCount,
      startLine,
      endLine: Math.max(startLine, endExclusive - 1),
      truncated: truncatedStart || truncatedEnd,
      ...(truncatedStart ? { truncatedStart: true } : {}),
      ...(truncatedEnd ? { truncatedEnd: true } : {}),
      ...(typeof buffer.type === "string" ? { bufferType: buffer.type } : {}),
      ...(cols !== undefined ? { cols } : {}),
      ...(rows !== undefined ? { rows } : {}),
      ...(finiteNumber(buffer.baseY) !== undefined ? { baseY: finiteNumber(buffer.baseY) } : {}),
      ...(finiteNumber(buffer.viewportY) !== undefined ? { viewportY: finiteNumber(buffer.viewportY) } : {}),
      ...(finiteNumber(buffer.cursorX) !== undefined ? { cursorX: finiteNumber(buffer.cursorX) } : {}),
      ...(finiteNumber(buffer.cursorY) !== undefined ? { cursorY: finiteNumber(buffer.cursorY) } : {}),
    });
    return true;
  };

  const readPath = (path: string): unknown => {
    if (!/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/.test(path)) return undefined;
    let current: unknown = window;
    for (const segment of path.split(".")) {
      if (!isObjectLike(current)) return undefined;
      try {
        current = current[segment];
      } catch {
        return undefined;
      }
    }
    return current;
  };

  for (const path of knownPaths) {
    const candidate = readPath(path);
    if (candidate !== undefined) addBufferTerminal(candidate, path);
  }

  const scanObjectGraph = (seed: unknown, label: string): void => {
    if (!isObjectLike(seed)) return;
    const queue: Array<{ value: UnknownRecord; label: string; depth: number }> = [{ value: seed, label, depth: 0 }];
    let inspected = 0;
    while (queue.length > 0 && inspected < 180 && terminals.length < 8) {
      const entry = queue.shift()!;
      const previousDepth = scannedObjectDepths.get(entry.value as object);
      if (previousDepth !== undefined && previousDepth <= entry.depth) continue;
      scannedObjectDepths.set(entry.value as object, entry.depth);
      inspected += 1;
      addBufferTerminal(entry.value, entry.label);
      if (entry.depth >= 2) continue;
      let descriptors: PropertyDescriptorMap;
      try {
        descriptors = Object.getOwnPropertyDescriptors(entry.value);
      } catch {
        continue;
      }
      for (const [key, descriptor] of Object.entries(descriptors)) {
        if (!("value" in descriptor) || !isObjectLike(descriptor.value)) continue;
        addBufferTerminal(descriptor.value, `${entry.label}.${key}`);
        if (entry.depth === 0 || candidatePattern.test(key)) {
          queue.push({ value: descriptor.value, label: `${entry.label}.${key}`, depth: entry.depth + 1 });
        }
      }
    }
  };

  let windowDescriptors: PropertyDescriptorMap = {};
  try {
    windowDescriptors = Object.getOwnPropertyDescriptors(window);
  } catch {
    // A hardened page can deny global descriptor inspection; DOM fallbacks still work.
  }
  for (const [key, descriptor] of Object.entries(windowDescriptors)) {
    if (!("value" in descriptor) || !isObjectLike(descriptor.value)) continue;
    addBufferTerminal(descriptor.value, key);
    if (candidatePattern.test(key)) scanObjectGraph(descriptor.value, key);
  }

  const elementSelector = (element: Element): string | undefined => {
    if (element.id) return `#${element.id}`;
    const classes = Array.from(element.classList ?? []).filter(Boolean).slice(0, 3);
    return classes.length > 0 ? `${element.tagName.toLowerCase()}.${classes.join(".")}` : element.tagName.toLowerCase();
  };
  const isVisible = (element: Element): boolean => {
    try {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    } catch {
      return false;
    }
  };
  const queryAllDeep = (root: ParentNode, selector: string): Element[] => {
    const matches = new Set<Element>();
    const roots: ParentNode[] = [root];
    const visitedRoots = new WeakSet<object>();
    let inspectedRoots = 0;
    while (roots.length > 0 && inspectedRoots < 100) {
      const current = roots.shift()!;
      if (visitedRoots.has(current as object)) continue;
      visitedRoots.add(current as object);
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
  const queryTerminalRoots = (): Element[] => {
    try {
      if (!input.selector) return queryAllDeep(document, ".xterm");
      const selected = queryAllDeep(document, input.selector);
      const roots = new Set<Element>();
      for (const element of selected) {
        if (element.matches?.(".xterm")) roots.add(element);
        for (const nested of queryAllDeep(element, ".xterm")) roots.add(nested);
      }
      if (roots.size === 0) selected.forEach((element) => roots.add(element));
      return [...roots];
    } catch (error) {
      warnings.push(`Terminal selector could not be queried: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  };
  const readRows = (root: Element, selectors: string[]): string[] => {
    for (const selector of selectors) {
      let rows: Element[] = [];
      try {
        rows = Array.from(root.querySelectorAll(selector));
      } catch {
        continue;
      }
      if (rows.length === 0) continue;
      const values = rows.map((row) => String(row.textContent ?? "").replace(/\u00a0/g, " ").replace(/\s+$/u, ""));
      const trimmed = trimTrailingEmptyLines(values);
      if (trimmed.some((line) => line.length > 0)) return trimmed;
    }
    return [];
  };

  const terminalRoots = queryTerminalRoots();
  for (const root of terminalRoots) {
    let ancestor: Element | null = root;
    for (let depth = 0; ancestor && depth < 20; depth += 1) {
      scanObjectGraph(
        ancestor as unknown as UnknownRecord,
        `${elementSelector(root) ?? "xterm-root"}.ancestor[${depth}]`,
      );
      ancestor = ancestor.parentElement;
    }
  }
  if (terminals.length === 0) {
    for (const root of terminalRoots) {
      const accessibilityLines = readRows(root, [
        '.xterm-accessibility-tree [role="listitem"]',
        ".xterm-accessibility-tree > div",
      ]);
      const domLines = accessibilityLines.length > 0 ? [] : readRows(root, [
        ".xterm-rows > div",
        ".xterm-rows .xterm-row",
      ]);
      const lines = accessibilityLines.length > 0 ? accessibilityLines : domLines;
      if (lines.length === 0) continue;
      let text = lines.join("\n");
      let truncated = false;
      if (text.length > input.maxChars) {
        text = input.scope === "tail" ? text.slice(-input.maxChars) : text.slice(0, input.maxChars);
        truncated = true;
      }
      terminals.push({
        source: accessibilityLines.length > 0 ? "xterm-accessibility" : "xterm-dom",
        selector: elementSelector(root),
        visible: isVisible(root),
        text,
        lineCount: lines.length,
        truncated,
        ...(truncated && input.scope === "tail" ? { truncatedStart: true } : {}),
        ...(truncated && input.scope !== "tail" ? { truncatedEnd: true } : {}),
      });
    }
  }

  const canvases: BrowserTerminalCanvasInfo[] = [];
  try {
    for (const element of queryAllDeep(document, "canvas").slice(0, 20)) {
      const canvas = element as HTMLCanvasElement;
      const rect = canvas.getBoundingClientRect();
      canvases.push({
        selector: elementSelector(canvas),
        width: canvas.width,
        height: canvas.height,
        clientWidth: Math.round(rect.width),
        clientHeight: Math.round(rect.height),
        ariaLabel: canvas.getAttribute("aria-label") || undefined,
        insideXterm: Boolean(canvas.closest(".xterm")),
      });
    }
  } catch {
    // Canvas metadata is diagnostic only and must not block terminal extraction.
  }

  if (terminals.length === 0 && canvases.length > 0) {
    warnings.push("Canvas pixels expose no semantic text. Use a targeted visual/OCR fallback when no xterm buffer or accessibility rows are available.");
  } else if (terminals.length === 0) {
    warnings.push("No readable xterm buffer, accessibility tree, or DOM terminal rows were found in this frame.");
  }

  return {
    readable: terminals.some((terminal) => terminal.text.length > 0),
    terminals,
    canvases,
    warnings,
  };
}
