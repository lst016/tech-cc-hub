import type {
  BrowserTerminalExtraction,
  NormalizedBrowserTerminalReadInput,
} from "./browser-terminal-reader.js";

type CdpRemoteObject = {
  objectId?: string;
  type?: string;
  subtype?: string;
  className?: string;
  description?: string;
  value?: unknown;
};

type CdpProperty = {
  name: string;
  value?: CdpRemoteObject;
};

type CdpDomNode = {
  nodeId?: number;
  backendNodeId?: number;
  nodeName?: string;
  attributes?: string[];
  children?: CdpDomNode[];
  contentDocument?: CdpDomNode;
  shadowRoots?: CdpDomNode[];
};

export type BrowserTerminalDebuggerClient = {
  sendCommand(method: string, params?: Record<string, unknown>): Promise<unknown>;
};

export type BrowserTerminalDebuggerResult = {
  terminal?: BrowserTerminalExtraction;
  objectsInspected: number;
  listenersInspected: number;
  warnings: string[];
};

type CdpQueueEntry = {
  objectId: string;
  path: string;
  depth: number;
};

const OBJECT_GROUP = "tech-cc-hub-terminal-read";
const MAX_DEBUGGER_OBJECTS = 400;
const MAX_DEBUGGER_DEPTH = 6;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function asRemoteObject(value: unknown): CdpRemoteObject {
  return asRecord(value) as CdpRemoteObject;
}

function nodeClassNames(node: CdpDomNode): string[] {
  const attributes = node.attributes ?? [];
  for (let index = 0; index < attributes.length - 1; index += 2) {
    if (attributes[index] === "class") {
      return String(attributes[index + 1] ?? "").split(/\s+/).filter(Boolean);
    }
  }
  return [];
}

function collectTerminalNodes(root: CdpDomNode): CdpDomNode[] {
  const matches: CdpDomNode[] = [];
  const queue: CdpDomNode[] = [root];
  const seen = new Set<number>();
  while (queue.length > 0 && seen.size < 20_000) {
    const node = queue.shift()!;
    const identity = node.backendNodeId ?? node.nodeId;
    if (identity && seen.has(identity)) continue;
    if (identity) seen.add(identity);
    const classes = nodeClassNames(node);
    if (classes.includes("xterm-helper-textarea") || classes.includes("xterm")) {
      matches.push(node);
    }
    if (node.contentDocument) queue.push(node.contentDocument);
    queue.push(...(node.children ?? []), ...(node.shadowRoots ?? []));
  }
  return matches;
}

function readRemoteProperties(value: unknown): { result: CdpProperty[]; internalProperties: CdpProperty[] } {
  const record = asRecord(value);
  return {
    result: Array.isArray(record.result) ? record.result as CdpProperty[] : [],
    internalProperties: Array.isArray(record.internalProperties)
      ? record.internalProperties as CdpProperty[]
      : [],
  };
}

function readCallValue(value: unknown): unknown {
  const result = asRemoteObject(asRecord(value).result);
  return result.value;
}

function shouldPrioritizeProperty(name: string): boolean {
  return /term|xterm|buffer|core|service|scope|component|instance|this/i.test(name);
}

function buildDebuggerProbeFunction(): string {
  return `function(input) {
    const isObjectLike = value => (typeof value === "object" && value !== null) || typeof value === "function";
    const isBufferLike = value => {
      try { return isObjectLike(value) && Number.isFinite(value.length) && typeof value.getLine === "function"; }
      catch { return false; }
    };
    const selectFromNamespace = namespace => {
      if (!isObjectLike(namespace)) return null;
      const selected = input.buffer === "normal" ? namespace.normal : namespace.active;
      if (isBufferLike(selected)) return selected;
      if (isBufferLike(namespace)) return namespace;
      return null;
    };
    const resolve = candidate => {
      if (!isObjectLike(candidate)) return null;
      try {
        if ("buffer" in candidate) {
          const direct = selectFromNamespace(candidate.buffer);
          if (direct) return { buffer: direct, owner: candidate, route: "buffer" };
        }
      } catch {}
      try {
        const service = candidate._bufferService;
        const direct = selectFromNamespace(service?.buffer);
        if (direct) return { buffer: direct, owner: candidate, route: "_bufferService.buffer" };
      } catch {}
      try {
        const core = candidate._core;
        const direct = selectFromNamespace(core?.buffer) || selectFromNamespace(core?._bufferService?.buffer);
        if (direct) return { buffer: direct, owner: candidate, route: "_core.buffer" };
      } catch {}
      return null;
    };
    const resolved = resolve(this);
    if (!resolved) return { matched: false };
    const buffer = resolved.buffer;
    const length = Math.max(0, Math.trunc(Number(buffer.length) || 0));
    const rows = Number(resolved.owner?.rows);
    const viewportY = Math.max(0, Math.trunc(Number(buffer.viewportY) || 0));
    let startLine = 0;
    let endExclusive = length;
    if (input.scope === "visible") {
      startLine = Math.min(length, viewportY);
      endExclusive = Math.min(length, startLine + Math.max(1, Number.isFinite(rows) ? Math.trunc(rows) : 1));
    } else if (input.scope === "tail") {
      startLine = Math.max(0, length - input.maxLines);
    } else if (endExclusive > input.maxLines) {
      endExclusive = input.maxLines;
    }
    if (endExclusive - startLine > input.maxLines) startLine = endExclusive - input.maxLines;
    const lines = [];
    let physicalLineCount = 0;
    for (let index = startLine; index < endExclusive; index += 1) {
      let line;
      try { line = buffer.getLine(index); } catch { continue; }
      if (!line) continue;
      physicalLineCount += 1;
      let text = "";
      try { text = String(line.translateToString(true)); } catch { continue; }
      if (line.isWrapped && lines.length > 0) lines[lines.length - 1] += text;
      else lines.push(text);
    }
    while (lines.length > 0 && !lines[lines.length - 1].trim()) lines.pop();
    let text = lines.join("\\n");
    let truncatedStart = startLine > 0;
    let truncatedEnd = endExclusive < length;
    if (text.length > input.maxChars) {
      if (input.scope === "tail") { text = text.slice(-input.maxChars); truncatedStart = true; }
      else { text = text.slice(0, input.maxChars); truncatedEnd = true; }
    }
    return {
      matched: true,
      route: resolved.route,
      extraction: {
        source: "xterm-debugger",
        text,
        lineCount: lines.length,
        physicalLineCount,
        startLine,
        endLine: Math.max(startLine, endExclusive - 1),
        truncated: truncatedStart || truncatedEnd,
        truncatedStart: truncatedStart || undefined,
        truncatedEnd: truncatedEnd || undefined,
        bufferType: typeof buffer.type === "string" ? buffer.type : undefined,
        cols: Number.isFinite(Number(resolved.owner?.cols)) ? Number(resolved.owner.cols) : undefined,
        rows: Number.isFinite(rows) ? rows : undefined,
        baseY: Number.isFinite(Number(buffer.baseY)) ? Number(buffer.baseY) : undefined,
        viewportY: Number.isFinite(Number(buffer.viewportY)) ? Number(buffer.viewportY) : undefined,
        cursorX: Number.isFinite(Number(buffer.cursorX)) ? Number(buffer.cursorX) : undefined,
        cursorY: Number.isFinite(Number(buffer.cursorY)) ? Number(buffer.cursorY) : undefined
      }
    };
  }`;
}

export async function extractBrowserTerminalViaDebugger(
  client: BrowserTerminalDebuggerClient,
  input: NormalizedBrowserTerminalReadInput,
): Promise<BrowserTerminalDebuggerResult> {
  const warnings: string[] = [];
  const queue: CdpQueueEntry[] = [];
  const visited = new Set<string>();
  let listenersInspected = 0;

  try {
    await client.sendCommand("DOM.enable");
    await client.sendCommand("Runtime.enable");
    await client.sendCommand("Debugger.enable");
    const documentResult = asRecord(await client.sendCommand("DOM.getDocument", { depth: -1, pierce: true }));
    const terminalNodes = collectTerminalNodes(asRecord(documentResult.root) as CdpDomNode);

    if (terminalNodes.length === 0) {
      const root = asRecord(documentResult.root) as CdpDomNode;
      const iframeNodes: CdpDomNode[] = [];
      const pending: CdpDomNode[] = [root];
      while (pending.length > 0 && iframeNodes.length < 50) {
        const node = pending.shift()!;
        if (node.nodeName === "IFRAME") iframeNodes.push(node);
        pending.push(...(node.children ?? []));
      }
      for (const iframe of iframeNodes) {
        if (!iframe.nodeId) continue;
        const described = asRecord(await client.sendCommand("DOM.describeNode", {
          nodeId: iframe.nodeId,
          depth: -1,
          pierce: true,
        }));
        terminalNodes.push(...collectTerminalNodes(asRecord(described.node) as CdpDomNode));
      }
    }

    for (const [nodeIndex, node] of terminalNodes.slice(0, 12).entries()) {
      const resolveParams = node.nodeId
        ? { nodeId: node.nodeId, objectGroup: OBJECT_GROUP }
        : { backendNodeId: node.backendNodeId, objectGroup: OBJECT_GROUP };
      const resolved = asRecord(await client.sendCommand("DOM.resolveNode", resolveParams));
      const remote = asRemoteObject(resolved.object);
      if (!remote.objectId) continue;
      queue.push({ objectId: remote.objectId, path: `dom[${nodeIndex}]`, depth: 0 });

      let ancestorObjectId: string | undefined = remote.objectId;
      for (let ancestorDepth = 0; ancestorObjectId && ancestorDepth < 20; ancestorDepth += 1) {
        const ancestorProperties = readRemoteProperties(await client.sendCommand("Runtime.getProperties", {
          objectId: ancestorObjectId,
          ownProperties: true,
          accessorPropertiesOnly: false,
          generatePreview: false,
        }));
        for (const property of ancestorProperties.result) {
          if (!/__vue|__react|fiber|component/i.test(property.name) || !property.value?.objectId) continue;
          queue.unshift({
            objectId: property.value.objectId,
            path: `dom[${nodeIndex}].ancestor[${ancestorDepth}].${property.name}`,
            depth: 0,
          });
        }
        const parentResult = asRecord(await client.sendCommand("Runtime.callFunctionOn", {
          objectId: ancestorObjectId,
          functionDeclaration: "function() { return this.parentElement; }",
          returnByValue: false,
          silent: true,
          objectGroup: OBJECT_GROUP,
        }));
        ancestorObjectId = asRemoteObject(parentResult.result).objectId;
      }

      const listenerResult = asRecord(await client.sendCommand("DOMDebugger.getEventListeners", {
        objectId: remote.objectId,
        depth: 5,
        pierce: true,
      }));
      const listeners = Array.isArray(listenerResult.listeners) ? listenerResult.listeners : [];
      listenersInspected += listeners.length;
      for (const [listenerIndex, listenerValue] of listeners.entries()) {
        const listener = asRecord(listenerValue);
        const handler = asRemoteObject(listener.handler);
        if (!handler.objectId) continue;
        queue.unshift({
          objectId: handler.objectId,
          path: `dom[${nodeIndex}].listener(${String(listener.type ?? listenerIndex)})`,
          depth: 0,
        });
      }
    }

    const probeFunction = buildDebuggerProbeFunction();
    while (queue.length > 0 && visited.size < MAX_DEBUGGER_OBJECTS) {
      const entry = queue.shift()!;
      if (visited.has(entry.objectId)) continue;
      visited.add(entry.objectId);

      const probed = asRecord(readCallValue(await client.sendCommand("Runtime.callFunctionOn", {
        objectId: entry.objectId,
        functionDeclaration: probeFunction,
        arguments: [{ value: input }],
        returnByValue: true,
        silent: true,
      })));
      if (probed.matched === true) {
        const extraction = asRecord(probed.extraction) as BrowserTerminalExtraction;
        return {
          terminal: {
            ...extraction,
            targetPath: `${entry.path}${typeof probed.route === "string" ? `.${probed.route}` : ""}`,
          },
          objectsInspected: visited.size,
          listenersInspected,
          warnings,
        };
      }

      if (entry.depth >= MAX_DEBUGGER_DEPTH) continue;
      const properties = readRemoteProperties(await client.sendCommand("Runtime.getProperties", {
        objectId: entry.objectId,
        ownProperties: true,
        accessorPropertiesOnly: false,
        generatePreview: false,
      }));
      const next: CdpQueueEntry[] = [];
      for (const property of [...properties.internalProperties, ...properties.result]) {
        const objectId = property.value?.objectId;
        if (!objectId || visited.has(objectId)) continue;
        next.push({
          objectId,
          path: `${entry.path}.${property.name}`,
          depth: entry.depth + 1,
        });
      }
      next.sort((left, right) => Number(shouldPrioritizeProperty(right.path)) - Number(shouldPrioritizeProperty(left.path)));
      queue.unshift(...next);
    }

    if (terminalNodes.length === 0) {
      warnings.push("CDP could not find an xterm root or helper textarea in the DOM tree.");
    } else if (listenersInspected === 0) {
      warnings.push("CDP found xterm DOM nodes, but no event-listener closures were available for inspection.");
    } else {
      warnings.push(`CDP inspected ${visited.size} closure objects without finding an xterm buffer.`);
    }
    return { objectsInspected: visited.size, listenersInspected, warnings };
  } catch (error) {
    warnings.push(`CDP terminal inspection failed: ${error instanceof Error ? error.message : String(error)}`);
    return { objectsInspected: visited.size, listenersInspected, warnings };
  } finally {
    try {
      await client.sendCommand("Runtime.releaseObjectGroup", { objectGroup: OBJECT_GROUP });
    } catch {
      // Releasing temporary remote objects is best-effort when a frame navigates mid-read.
    }
  }
}
