import {
  createSdkMcpServer,
  tool,
  type McpSdkServerConfigWithInstance,
} from "@anthropic-ai/claude-agent-sdk";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { loadGlobalRuntimeConfig } from "../config-store.js";
import {
  FIGMA_OFFICIAL_PLUGIN_ID,
  FIGMA_REST_API_URL,
  FIGMA_REST_TOOL_NAMES,
} from "../figma-official-plugin.js";
import {
  FIGMA_DESIGN_AUDIT_FRAMEWORKS,
  FIGMA_DESIGN_DOMAINS,
  buildFigmaDesignAudit,
  buildFigmaDesignPlaybook,
} from "./figma-design-intelligence.js";
import { toTextToolResult } from "./tool-result.js";

export { FIGMA_REST_TOOL_NAMES };

const FIGMA_REST_SERVER_NAME = "tech-cc-hub-figma";
const FIGMA_REST_SERVER_VERSION = "1.0.0";
const DEFAULT_MAX_BYTES = 160_000;
const MAX_RESPONSE_BYTES = 500_000;
const FIGMA_FILE_LIBRARY_KINDS = ["components", "component_sets", "styles"] as const;
const FIGMA_VARIABLE_KINDS = ["local", "published"] as const;
const FIGMA_CODE_OUTPUTS = ["react", "html"] as const;
const DEFAULT_SUMMARY_DEPTH = 4;
const DEFAULT_SUMMARY_MAX_NODES = 120;

let figmaRestMcpServer: McpSdkServerConfigWithInstance | null = null;

type FigmaLocator = {
  fileKey: string;
  nodeIds: string[];
};

type CompactDesignNode = {
  id?: string;
  name?: string;
  type?: string;
  visible?: boolean;
  bounds?: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  };
  layout?: Record<string, unknown>;
  style?: Record<string, unknown>;
  text?: Record<string, unknown>;
  children?: CompactDesignNode[];
};

type DesignTokenSummary = {
  colors: Array<{ value: string; count: number; usages: string[] }>;
  typography: Array<{ value: string; count: number; usages: string[] }>;
  radii: Array<{ value: number; count: number; usages: string[] }>;
  spacing: Array<{ value: number; count: number; usages: string[] }>;
  effects: Array<{ value: string; count: number; usages: string[] }>;
};

type DesignSummary = {
  nodes: CompactDesignNode[];
  tokens: DesignTokenSummary;
  stats: {
    visited: number;
    emitted: number;
    truncated: boolean;
  };
  warnings: string[];
};

type FigmaNodeIndexEntry = {
  id?: string;
  name?: string;
  type?: string;
  visible?: boolean;
  bounds?: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  };
  childCount: number;
  path: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getConfiguredFigmaPat(): string {
  const config = loadGlobalRuntimeConfig();
  const plugins = isRecord(config.plugins) ? config.plugins : {};
  const plugin = isRecord(plugins[FIGMA_OFFICIAL_PLUGIN_ID]) ? plugins[FIGMA_OFFICIAL_PLUGIN_ID] : null;
  const oauth = isRecord(plugin?.oauth) ? plugin.oauth : null;
  const isPatMode = plugin?.mode === "rest" || plugin?.authProvider === "pat" || oauth?.provider === "pat";
  const token = typeof oauth?.access_token === "string" ? oauth.access_token.trim() : "";
  if (!isPatMode || !token) {
    throw new Error("Figma token is not configured. Add a Figma Personal Access Token in Settings > Plugins first.");
  }
  return token;
}

function parseFigmaLocator(fileKeyOrUrl: string, explicitNodeIds: string[] = []): FigmaLocator {
  const raw = fileKeyOrUrl.trim();
  if (!raw) {
    throw new Error("Missing Figma file key or URL.");
  }

  const parsedNodeIds = explicitNodeIds.map(normalizeNodeId).filter(Boolean);
  try {
    const url = new URL(raw);
    if (!/figma\.com$/i.test(url.hostname) && !url.hostname.endsWith(".figma.com")) {
      throw new Error("Not a Figma URL.");
    }

    const segments = url.pathname.split("/").filter(Boolean);
    const keySegmentIndex = segments.findIndex((segment) => (
      segment === "design" ||
      segment === "file" ||
      segment === "board" ||
      segment === "slides" ||
      segment === "proto" ||
      segment === "make"
    ));
    const fileKey = keySegmentIndex >= 0 ? segments[keySegmentIndex + 1] : "";
    if (!fileKey) {
      throw new Error("Could not parse a Figma file key from the URL.");
    }

    const nodeIdFromUrl = normalizeNodeId(url.searchParams.get("node-id") ?? "");
    return {
      fileKey,
      nodeIds: parsedNodeIds.length > 0 ? parsedNodeIds : nodeIdFromUrl ? [nodeIdFromUrl] : [],
    };
  } catch (error) {
    if (error instanceof TypeError) {
      return { fileKey: raw, nodeIds: parsedNodeIds };
    }
    throw error;
  }
}

function normalizeNodeId(nodeId: string): string {
  return nodeId.trim().replace(/-/g, ":");
}

function clampMaxBytes(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_MAX_BYTES;
  }
  return Math.min(Math.max(Math.floor(value), 10_000), MAX_RESPONSE_BYTES);
}

async function figmaApiGet(pathname: string, query: Record<string, string | number | boolean | undefined>, token: string): Promise<unknown> {
  const url = new URL(`${FIGMA_REST_API_URL}/${pathname.replace(/^\/+/, "")}`);
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === "") {
      continue;
    }
    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "X-Figma-Token": token,
    },
  });
  const bodyText = await response.text();
  const body = parseJsonBody(bodyText);

  if (!response.ok) {
    const message = getFigmaApiErrorMessage(body, bodyText);
    throw new Error(`Figma API ${response.status}: ${message}`);
  }

  return body;
}

function parseJsonBody(text: string): unknown {
  if (!text.trim()) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function getFigmaApiErrorMessage(body: unknown, fallback: string): string {
  if (isRecord(body)) {
    if (typeof body.err === "string") return body.err;
    if (typeof body.message === "string") return body.message;
    if (typeof body.status === "string") return body.status;
  }
  return fallback.trim() || "璇锋眰澶辫触";
}

function capPayload(payload: unknown, maxBytes: number): unknown {
  const text = JSON.stringify(payload, null, 2);
  if (text.length <= maxBytes) {
    return payload;
  }
  return {
    truncated: true,
    maxBytes,
    bytes: text.length,
    jsonPreview: text.slice(0, maxBytes),
  };
}

function capFigmaDesignPayload(
  payload: unknown,
  maxBytes: number,
  options: {
    fileKey: string;
    fileKeyOrUrl: string;
    currentNodeIds: string[];
    currentDepth?: number;
  },
): unknown {
  const capped = capPayload(payload, maxBytes);
  if (!isRecord(capped) || capped.truncated !== true) {
    return capped;
  }

  const roots = extractDocumentNodes(payload, options.currentNodeIds);
  const nodeIndex = buildFigmaNodeIndex(roots, 80);
  const recommendedNodeIds = pickRecommendedNodeIds(nodeIndex, options.currentNodeIds);

  return {
    truncated: true,
    maxBytes: capped.maxBytes,
    bytes: capped.bytes,
    progressiveDisclosure: {
      reason: "Figma response is larger than maxBytes. Use the node index below to drill into only the relevant branch instead of increasing maxBytes.",
      fileKey: options.fileKey,
      currentNodeIds: options.currentNodeIds,
      currentDepth: options.currentDepth,
      recommendedNextTool: "figma_summarize_design",
      recommendedNextInput: {
        fileKeyOrUrl: options.fileKeyOrUrl,
        nodeIds: recommendedNodeIds,
        depth: 3,
        maxNodes: 160,
      },
      alternatives: [
        "Use figma_read_design with one nodeId and a small depth when raw node JSON is required.",
        "Use figma_get_image_urls with the same nodeIds when visual layout is more useful than JSON.",
        "Use figma_generate_tailwind_code after selecting the smallest frame that matches the implementation target.",
      ],
      nodeIndex,
    },
    jsonPreview: capped.jsonPreview,
  };
}

function getFigmaFileKey(fileKeyOrUrl: string): string {
  return parseFigmaLocator(fileKeyOrUrl).fileKey;
}

function toFigmaErrorResult(action: string, error: unknown): CallToolResult {
  return toTextToolResult({
    action,
    success: false,
    error: error instanceof Error ? error.message : String(error),
  }, true);
}

function countRecordKeys(value: unknown): number {
  return isRecord(value) ? Object.keys(value).length : 0;
}

function summarizeFileMetadataFromDocument(payload: unknown): unknown {
  if (!isRecord(payload)) {
    return payload;
  }
  const document = isRecord(payload.document) ? payload.document : {};
  const pages = Array.isArray(document.children)
    ? document.children
      .filter(isRecord)
      .map((page) => ({
        id: typeof page.id === "string" ? page.id : undefined,
        name: typeof page.name === "string" ? page.name : undefined,
        type: typeof page.type === "string" ? page.type : undefined,
        childCount: Array.isArray(page.children) ? page.children.length : 0,
      }))
    : [];

  return {
    name: payload.name,
    role: payload.role,
    lastModified: payload.lastModified,
    editorType: payload.editorType,
    thumbnailUrl: payload.thumbnailUrl,
    version: payload.version,
    linkAccess: payload.linkAccess,
    mainFileKey: payload.mainFileKey,
    branches: payload.branches,
    schemaVersion: payload.schemaVersion,
    pages,
    counts: {
      pages: pages.length,
      components: countRecordKeys(payload.components),
      componentSets: countRecordKeys(payload.componentSets),
      styles: countRecordKeys(payload.styles),
    },
  };
}

function buildFigmaNodeIndex(roots: Record<string, unknown>[], maxEntries: number): FigmaNodeIndexEntry[] {
  const entries: FigmaNodeIndexEntry[] = [];

  const visit = (node: Record<string, unknown>, pathParts: string[]) => {
    if (entries.length >= maxEntries) {
      return;
    }

    const name = readString(node, "name") || "(unnamed)";
    const children = Array.isArray(node.children) ? node.children.filter(isRecord) : [];
    const entry: FigmaNodeIndexEntry = {
      id: readString(node, "id"),
      name,
      type: readString(node, "type"),
      visible: readBoolean(node, "visible"),
      bounds: readNodeIndexBounds(node),
      childCount: children.length,
      path: [...pathParts, name].join(" / "),
    };

    entries.push(entry);
    for (const child of children) {
      visit(child, [...pathParts, name]);
      if (entries.length >= maxEntries) {
        break;
      }
    }
  };

  for (const root of roots) {
    visit(root, []);
    if (entries.length >= maxEntries) {
      break;
    }
  }

  return entries;
}

function pickRecommendedNodeIds(index: FigmaNodeIndexEntry[], currentNodeIds: string[]): string[] {
  const branchCandidates = index
    .filter((entry) => entry.id && entry.childCount > 0)
    .filter((entry) => !currentNodeIds.includes(entry.id ?? ""));

  const preferred = branchCandidates.find((entry) => {
    const text = `${entry.name ?? ""} ${entry.path}`.toLowerCase();
    return /form|frame|content|section|container|椤甸潰|琛ㄥ崟|鍩虹|姝ｆ枃|鎸夐挳|棰勮|妯℃澘/.test(text);
  }) ?? branchCandidates[0] ?? index.find((entry) => entry.id);

  return preferred?.id ? [preferred.id] : [];
}

function filterFigmaNodeIndex(index: FigmaNodeIndexEntry[], query?: string): FigmaNodeIndexEntry[] {
  const normalizedQuery = query?.trim().toLowerCase();
  if (!normalizedQuery) {
    return index;
  }

  const terms = normalizedQuery.split(/\s+/).filter(Boolean);
  if (terms.length === 0) {
    return index;
  }

  return index.filter((entry) => {
    const haystack = [
      entry.id,
      entry.name,
      entry.type,
      entry.path,
    ].filter(Boolean).join(" ").toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}

function readNodeIndexBounds(node: Record<string, unknown>): FigmaNodeIndexEntry["bounds"] | undefined {
  const box = isRecord(node.absoluteBoundingBox)
    ? node.absoluteBoundingBox
    : isRecord(node.absoluteRenderBounds)
      ? node.absoluteRenderBounds
      : null;
  if (!box) {
    return undefined;
  }

  return {
    x: readNumber(box, "x"),
    y: readNumber(box, "y"),
    width: readNumber(box, "width"),
    height: readNumber(box, "height"),
  };
}

async function fetchFigmaDesignPayload(
  token: string,
  fileKeyOrUrl: string,
  nodeIds: string[] | undefined,
  options: {
    depth?: number;
    geometry?: boolean;
    branchData?: boolean;
  } = {},
): Promise<{ locator: FigmaLocator; payload: unknown; source: string }> {
  const locator = parseFigmaLocator(fileKeyOrUrl, nodeIds);
  const hasNodeIds = locator.nodeIds.length > 0;
  const source = hasNodeIds ? "files/:key/nodes" : "files/:key";
  const endpoint = hasNodeIds
    ? `files/${encodeURIComponent(locator.fileKey)}/nodes`
    : `files/${encodeURIComponent(locator.fileKey)}`;
  const payload = await figmaApiGet(endpoint, {
    ids: hasNodeIds ? locator.nodeIds.join(",") : undefined,
    depth: options.depth,
    geometry: options.geometry ? "paths" : undefined,
    branch_data: options.branchData,
  }, token);
  return { locator, payload, source };
}

function extractDocumentNodes(payload: unknown, requestedNodeIds: string[]): Record<string, unknown>[] {
  if (!isRecord(payload)) {
    return [];
  }
  const nodes = isRecord(payload.nodes) ? payload.nodes : null;
  if (nodes) {
    const ids = requestedNodeIds.length > 0 ? requestedNodeIds : Object.keys(nodes);
    return ids
      .map((id) => {
        const entry = nodes[id];
        return isRecord(entry) && isRecord(entry.document) ? entry.document : null;
      })
      .filter(isRecord);
  }
  return isRecord(payload.document) ? [payload.document] : [];
}

function buildDesignSummary(
  roots: Record<string, unknown>[],
  options: {
    maxDepth?: number;
    maxNodes?: number;
    includeInvisible?: boolean;
  } = {},
): DesignSummary {
  const warnings: string[] = [];
  const stats = { visited: 0, emitted: 0, truncated: false };
  const maxDepth = clampInteger(options.maxDepth, 1, 12, DEFAULT_SUMMARY_DEPTH);
  const maxNodes = clampInteger(options.maxNodes, 1, 2_000, DEFAULT_SUMMARY_MAX_NODES);
  const nodes = roots
    .map((root) => compactDesignNode(root, {
      depth: 0,
      maxDepth,
      maxNodes,
      includeInvisible: options.includeInvisible === true,
      stats,
      warnings,
    }))
    .filter((node): node is CompactDesignNode => Boolean(node));
  return {
    nodes,
    tokens: extractDesignTokens(roots, maxNodes),
    stats,
    warnings,
  };
}

function compactDesignNode(
  node: Record<string, unknown>,
  context: {
    depth: number;
    maxDepth: number;
    maxNodes: number;
    includeInvisible: boolean;
    stats: DesignSummary["stats"];
    warnings: string[];
  },
): CompactDesignNode | null {
  context.stats.visited++;
  if (context.stats.emitted >= context.maxNodes) {
    context.stats.truncated = true;
    return null;
  }
  const visible = readBoolean(node, "visible");
  if (visible === false && !context.includeInvisible) {
    return null;
  }

  context.stats.emitted++;
  const compact: CompactDesignNode = {
    id: readString(node, "id"),
    name: readString(node, "name"),
    type: readString(node, "type"),
  };
  if (visible === false) {
    compact.visible = false;
  }

  const bounds = readBounds(node);
  if (bounds) {
    compact.bounds = bounds;
  }

  const layout = extractLayoutInfo(node);
  if (Object.keys(layout).length > 0) {
    compact.layout = layout;
  }

  const style = extractStyleInfo(node);
  if (Object.keys(style).length > 0) {
    compact.style = style;
  }

  if (compact.type === "TEXT") {
    const text = extractTextInfo(node);
    if (Object.keys(text).length > 0) {
      compact.text = text;
    }
  }

  if (context.depth < context.maxDepth) {
    const children = getNodeChildren(node)
      .map((child) => compactDesignNode(child, {
        ...context,
        depth: context.depth + 1,
      }))
      .filter((child): child is CompactDesignNode => Boolean(child));
    if (children.length > 0) {
      compact.children = children;
    }
  } else if (getNodeChildren(node).length > 0) {
    context.warnings.push(`Node ${compact.name ?? compact.id ?? "(unknown)"} reached maxDepth=${context.maxDepth}; child nodes were omitted.`);
  }

  return compact;
}

function extractLayoutInfo(node: Record<string, unknown>): Record<string, unknown> {
  const layout: Record<string, unknown> = {};
  for (const key of [
    "layoutMode",
    "primaryAxisAlignItems",
    "counterAxisAlignItems",
    "layoutWrap",
    "layoutSizingHorizontal",
    "layoutSizingVertical",
    "layoutPositioning",
  ]) {
    const value = readString(node, key);
    if (value) {
      layout[key] = value;
    }
  }
  for (const key of ["itemSpacing", "paddingLeft", "paddingRight", "paddingTop", "paddingBottom"]) {
    const value = readNumber(node, key);
    if (value !== undefined) {
      layout[key] = value;
    }
  }
  return layout;
}

function extractStyleInfo(node: Record<string, unknown>): Record<string, unknown> {
  const style: Record<string, unknown> = {};
  const fills = getPaintSummaries(node.fills);
  const strokes = getPaintSummaries(node.strokes);
  if (fills.length > 0) style.fills = fills;
  if (strokes.length > 0) style.strokes = strokes;
  const radius = readNumber(node, "cornerRadius");
  if (radius !== undefined) style.cornerRadius = radius;
  const opacity = readNumber(node, "opacity");
  if (opacity !== undefined && opacity !== 1) style.opacity = opacity;
  const effects = getEffectSummaries(node.effects);
  if (effects.length > 0) style.effects = effects;
  return style;
}

function extractTextInfo(node: Record<string, unknown>): Record<string, unknown> {
  const text: Record<string, unknown> = {};
  const characters = readString(node, "characters");
  if (characters) {
    text.characters = characters.slice(0, 1_000);
  }
  const style = isRecord(node.style) ? node.style : {};
  for (const key of ["fontFamily", "fontPostScriptName", "fontSize", "fontWeight", "lineHeightPx", "letterSpacing", "textAlignHorizontal", "textAlignVertical"]) {
    const value = style[key];
    if (typeof value === "string" || typeof value === "number") {
      text[key] = value;
    }
  }
  return text;
}

function extractDesignTokens(roots: Record<string, unknown>[], maxNodes: number): DesignTokenSummary {
  const colors = new Map<string, { count: number; usages: Set<string> }>();
  const typography = new Map<string, { count: number; usages: Set<string> }>();
  const radii = new Map<number, { count: number; usages: Set<string> }>();
  const spacing = new Map<number, { count: number; usages: Set<string> }>();
  const effects = new Map<string, { count: number; usages: Set<string> }>();
  let visited = 0;

  walkNodes(roots, (node) => {
    if (visited >= maxNodes) {
      return;
    }
    visited++;
    const usage = `${readString(node, "name") ?? "node"}${readString(node, "id") ? ` (${readString(node, "id")})` : ""}`;
    for (const paint of [...getPaintSummaries(node.fills), ...getPaintSummaries(node.strokes)]) {
      if (paint.color) addToken(colors, paint.color, usage);
    }
    const style = isRecord(node.style) ? node.style : {};
    const fontFamily = typeof style.fontFamily === "string" ? style.fontFamily : "";
    const fontSize = typeof style.fontSize === "number" ? style.fontSize : undefined;
    const fontWeight = typeof style.fontWeight === "number" ? style.fontWeight : undefined;
    const lineHeight = typeof style.lineHeightPx === "number" ? style.lineHeightPx : undefined;
    if (fontFamily || fontSize || fontWeight || lineHeight) {
      addToken(typography, `${fontFamily || "font"} ${fontSize ?? "-"}px ${fontWeight ?? "-"} ${lineHeight ?? "-"}px`, usage);
    }
    for (const key of ["cornerRadius", "rectangleCornerRadii"]) {
      const value = node[key];
      if (typeof value === "number") {
        addToken(radii, value, usage);
      } else if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === "number") addToken(radii, item, usage);
        }
      }
    }
    for (const key of ["itemSpacing", "paddingLeft", "paddingRight", "paddingTop", "paddingBottom"]) {
      const value = readNumber(node, key);
      if (value !== undefined) addToken(spacing, value, usage);
    }
    for (const effect of getEffectSummaries(node.effects)) {
      addToken(effects, effect, usage);
    }
  });

  return {
    colors: mapTokenEntries(colors),
    typography: mapTokenEntries(typography),
    radii: mapNumericTokenEntries(radii),
    spacing: mapNumericTokenEntries(spacing),
    effects: mapTokenEntries(effects),
  };
}

function walkNodes(nodes: Record<string, unknown>[], visit: (node: Record<string, unknown>) => void): void {
  for (const node of nodes) {
    visit(node);
    walkNodes(getNodeChildren(node), visit);
  }
}

function addToken<T extends string | number>(map: Map<T, { count: number; usages: Set<string> }>, key: T, usage: string): void {
  const existing = map.get(key) ?? { count: 0, usages: new Set<string>() };
  existing.count++;
  existing.usages.add(usage);
  map.set(key, existing);
}

function mapTokenEntries(map: Map<string, { count: number; usages: Set<string> }>): Array<{ value: string; count: number; usages: string[] }> {
  return [...map.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 80)
    .map(([value, item]) => ({ value, count: item.count, usages: [...item.usages].slice(0, 8) }));
}

function mapNumericTokenEntries(map: Map<number, { count: number; usages: Set<string> }>): Array<{ value: number; count: number; usages: string[] }> {
  return [...map.entries()]
    .sort((a, b) => b[1].count - a[1].count || a[0] - b[0])
    .slice(0, 80)
    .map(([value, item]) => ({ value, count: item.count, usages: [...item.usages].slice(0, 8) }));
}

function getNodeChildren(node: Record<string, unknown>): Record<string, unknown>[] {
  return Array.isArray(node.children) ? node.children.filter(isRecord) : [];
}

function readBounds(node: Record<string, unknown>): CompactDesignNode["bounds"] | undefined {
  const box = isRecord(node.absoluteBoundingBox)
    ? node.absoluteBoundingBox
    : isRecord(node.absoluteRenderBounds)
      ? node.absoluteRenderBounds
      : null;
  if (!box) {
    return undefined;
  }
  const x = readNumber(box, "x");
  const y = readNumber(box, "y");
  const width = readNumber(box, "width");
  const height = readNumber(box, "height");
  if (x === undefined && y === undefined && width === undefined && height === undefined) {
    return undefined;
  }
  return { x, y, width, height };
}

function getPaintSummaries(value: unknown): Array<{ type: string; color?: string; opacity?: number; visible?: boolean }> {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter(isRecord)
    .filter((paint) => paint.visible !== false)
    .map((paint) => {
      const type = readString(paint, "type") ?? "PAINT";
      const opacity = readNumber(paint, "opacity");
      const summary: { type: string; color?: string; opacity?: number; visible?: boolean } = { type };
      if (paint.visible === false) summary.visible = false;
      if (opacity !== undefined && opacity !== 1) summary.opacity = opacity;
      if (type === "SOLID" && isRecord(paint.color)) {
        summary.color = colorToHex(paint.color, opacity);
      } else if (type.startsWith("GRADIENT") && Array.isArray(paint.gradientStops)) {
        const stops = paint.gradientStops
          .filter(isRecord)
          .map((stop) => isRecord(stop.color) ? colorToHex(stop.color, readNumber(stop, "opacity")) : null)
          .filter((item): item is string => Boolean(item));
        if (stops.length > 0) {
          summary.color = `${type}(${stops.join(", ")})`;
        }
      }
      return summary;
    });
}

function getEffectSummaries(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter(isRecord)
    .filter((effect) => effect.visible !== false)
    .map((effect) => {
      const type = readString(effect, "type") ?? "EFFECT";
      const radius = readNumber(effect, "radius");
      const offset = isRecord(effect.offset) ? effect.offset : {};
      const x = readNumber(offset, "x") ?? 0;
      const y = readNumber(offset, "y") ?? 0;
      const color = isRecord(effect.color) ? colorToHex(effect.color, readNumber(effect, "opacity")) : "";
      return [type, radius !== undefined ? `r${roundNumber(radius)}` : "", x || y ? `${roundNumber(x)},${roundNumber(y)}` : "", color].filter(Boolean).join(" ");
    });
}

function colorToHex(color: Record<string, unknown>, opacity?: number): string {
  const r = Math.round((readNumber(color, "r") ?? 0) * 255);
  const g = Math.round((readNumber(color, "g") ?? 0) * 255);
  const b = Math.round((readNumber(color, "b") ?? 0) * 255);
  const a = readNumber(color, "a") ?? opacity ?? 1;
  const hex = `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`;
  return a < 1 ? `${hex}/${Math.round(a * 100)}` : hex;
}

function toHexByte(value: number): string {
  return Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0");
}

function readString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function readNumber(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readBoolean(record: Record<string, unknown>, key: string): boolean | undefined {
  const value = record[key];
  return typeof value === "boolean" ? value : undefined;
}

function clampInteger(value: number | undefined, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(Math.max(Math.floor(value), min), max);
}

function roundNumber(value: number): number {
  return Math.round(value * 100) / 100;
}

function generateTailwindCode(roots: CompactDesignNode[], output: typeof FIGMA_CODE_OUTPUTS[number], componentName: string | undefined): string {
  const body = roots.map((node) => renderTailwindNode(node, output, 2, true)).join("\n");
  if (output === "html") {
    return body.trim();
  }
  const safeName = sanitizeComponentName(componentName ?? roots[0]?.name ?? "FigmaComponent");
  return [
    `export function ${safeName}() {`,
    "  return (",
    body,
    "  );",
    "}",
  ].join("\n");
}

function renderTailwindNode(node: CompactDesignNode, output: typeof FIGMA_CODE_OUTPUTS[number], indent: number, isRoot = false): string {
  const pad = " ".repeat(indent);
  const attr = output === "react" ? "className" : "class";
  const classes = buildTailwindClasses(node, isRoot);
  const classAttr = classes.length > 0 ? ` ${attr}="${classes.join(" ")}"` : "";
  const tag = node.type === "TEXT" ? "p" : "div";
  if (node.type === "TEXT") {
    return `${pad}<${tag}${classAttr}>${escapeHtml(String(node.text?.characters ?? node.name ?? ""))}</${tag}>`;
  }
  const children = node.children ?? [];
  if (children.length === 0) {
    return `${pad}<${tag}${classAttr}></${tag}>`;
  }
  const childText = children.map((child) => renderTailwindNode(child, output, indent + 2)).join("\n");
  return `${pad}<${tag}${classAttr}>\n${childText}\n${pad}</${tag}>`;
}

function buildTailwindClasses(node: CompactDesignNode, isRoot: boolean): string[] {
  const classes: string[] = [];
  const layoutMode = typeof node.layout?.layoutMode === "string" ? node.layout.layoutMode : "";
  if (layoutMode === "HORIZONTAL" || layoutMode === "VERTICAL") {
    classes.push("flex", layoutMode === "HORIZONTAL" ? "flex-row" : "flex-col");
    const gap = typeof node.layout?.itemSpacing === "number" ? node.layout.itemSpacing : undefined;
    if (gap !== undefined) classes.push(`gap-[${roundNumber(gap)}px]`);
    addAlignmentClasses(classes, node);
  }
  addPaddingClasses(classes, node);
  if (isRoot) {
    classes.push("w-full");
  } else {
    if (node.bounds?.width !== undefined) classes.push(`w-[${roundNumber(node.bounds.width)}px]`);
    if (node.bounds?.height !== undefined && node.type !== "TEXT") classes.push(`min-h-[${roundNumber(node.bounds.height)}px]`);
  }
  const fills = Array.isArray(node.style?.fills) ? node.style.fills.filter(isRecord) : [];
  const solidFill = fills.find((fill) => typeof fill.color === "string" && fill.color.startsWith("#"));
  if (solidFill && typeof solidFill.color === "string") {
    classes.push(node.type === "TEXT" ? tailwindColorClass("text", solidFill.color) : tailwindColorClass("bg", solidFill.color));
  }
  const strokes = Array.isArray(node.style?.strokes) ? node.style.strokes.filter(isRecord) : [];
  const solidStroke = strokes.find((stroke) => typeof stroke.color === "string" && stroke.color.startsWith("#"));
  if (solidStroke && typeof solidStroke.color === "string") {
    classes.push("border", tailwindColorClass("border", solidStroke.color));
  }
  if (typeof node.style?.cornerRadius === "number") {
    classes.push(`rounded-[${roundNumber(node.style.cornerRadius)}px]`);
  }
  if (node.type === "TEXT") {
    addTextClasses(classes, node);
  }
  return [...new Set(classes)];
}

function addAlignmentClasses(classes: string[], node: CompactDesignNode): void {
  const primary = node.layout?.primaryAxisAlignItems;
  const counter = node.layout?.counterAxisAlignItems;
  if (primary === "CENTER") classes.push("justify-center");
  if (primary === "MAX") classes.push("justify-end");
  if (primary === "SPACE_BETWEEN") classes.push("justify-between");
  if (counter === "CENTER") classes.push("items-center");
  if (counter === "MAX") classes.push("items-end");
}

function addPaddingClasses(classes: string[], node: CompactDesignNode): void {
  const top = typeof node.layout?.paddingTop === "number" ? node.layout.paddingTop : undefined;
  const right = typeof node.layout?.paddingRight === "number" ? node.layout.paddingRight : undefined;
  const bottom = typeof node.layout?.paddingBottom === "number" ? node.layout.paddingBottom : undefined;
  const left = typeof node.layout?.paddingLeft === "number" ? node.layout.paddingLeft : undefined;
  if (top === undefined && right === undefined && bottom === undefined && left === undefined) {
    return;
  }
  if (top === right && right === bottom && bottom === left && top !== undefined) {
    classes.push(`p-[${roundNumber(top)}px]`);
    return;
  }
  if (left !== undefined && left === right) classes.push(`px-[${roundNumber(left)}px]`);
  else {
    if (left !== undefined) classes.push(`pl-[${roundNumber(left)}px]`);
    if (right !== undefined) classes.push(`pr-[${roundNumber(right)}px]`);
  }
  if (top !== undefined && top === bottom) classes.push(`py-[${roundNumber(top)}px]`);
  else {
    if (top !== undefined) classes.push(`pt-[${roundNumber(top)}px]`);
    if (bottom !== undefined) classes.push(`pb-[${roundNumber(bottom)}px]`);
  }
}

function addTextClasses(classes: string[], node: CompactDesignNode): void {
  if (typeof node.text?.fontSize === "number") {
    classes.push(`text-[${roundNumber(node.text.fontSize)}px]`);
  }
  if (typeof node.text?.fontWeight === "number") {
    if (node.text.fontWeight >= 700) classes.push("font-bold");
    else if (node.text.fontWeight >= 600) classes.push("font-semibold");
    else if (node.text.fontWeight <= 300) classes.push("font-light");
    else classes.push("font-normal");
  }
  if (typeof node.text?.lineHeightPx === "number") {
    classes.push(`leading-[${roundNumber(node.text.lineHeightPx)}px]`);
  }
  if (node.text?.textAlignHorizontal === "CENTER") classes.push("text-center");
  if (node.text?.textAlignHorizontal === "RIGHT") classes.push("text-right");
}

function tailwindColorClass(prefix: string, color: string): string {
  const [hex, opacity] = color.split("/");
  return opacity ? `${prefix}-[${hex}]/${opacity}` : `${prefix}-[${hex}]`;
}

function sanitizeComponentName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9]+/g, " ").trim();
  const pascal = cleaned.split(/\s+/).filter(Boolean).map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join("");
  return /^[A-Z]/.test(pascal) ? pascal : `Figma${pascal || "Component"}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function getFigmaRestMcpServer(): McpSdkServerConfigWithInstance {
  if (figmaRestMcpServer) {
    return figmaRestMcpServer;
  }

  const currentUserTool = tool(
    "figma_get_current_user",
    "Read the current Figma user with the locally saved Personal Access Token. Requires current_user:read scope.",
    {
      maxBytes: z.number().int().min(10_000).max(MAX_RESPONSE_BYTES).optional(),
    },
    async (input) => {
      try {
        const token = getConfiguredFigmaPat();
        const payload = await figmaApiGet("me", {}, token);
        return toTextToolResult({
          action: "figma_get_current_user",
          success: true,
          result: capPayload(payload, clampMaxBytes(input.maxBytes)),
        });
      } catch (error) {
        return toFigmaErrorResult("figma_get_current_user", error);
      }
    },
  );

  const fileMetadataTool = tool(
    "figma_get_file_metadata",
    "Read Figma file metadata. Can fall back to a lightweight file overview when metadata scope is unavailable.",
    {
      fileKeyOrUrl: z.string().trim().min(1),
      fallbackToFileOverview: z.boolean().optional(),
      branchData: z.boolean().optional(),
      maxBytes: z.number().int().min(10_000).max(MAX_RESPONSE_BYTES).optional(),
    },
    async (input) => {
      const action = "figma_get_file_metadata";
      try {
        const token = getConfiguredFigmaPat();
        const fileKey = getFigmaFileKey(input.fileKeyOrUrl);
        let payload: unknown;
        let source = "files/:key/meta";
        try {
          payload = await figmaApiGet(`files/${encodeURIComponent(fileKey)}/meta`, {}, token);
        } catch (error) {
          if (!input.fallbackToFileOverview) {
            throw error;
          }
          source = "files/:key?depth=1";
          payload = summarizeFileMetadataFromDocument(await figmaApiGet(`files/${encodeURIComponent(fileKey)}`, {
            depth: 1,
            branch_data: input.branchData,
          }, token));
        }
        return toTextToolResult({
          action,
          success: true,
          fileKey,
          source,
          result: capPayload(payload, clampMaxBytes(input.maxBytes)),
        });
      } catch (error) {
        return toFigmaErrorResult(action, error);
      }
    },
  );

  const readDesignTool = tool(
    "figma_read_design",
    "Read a Figma file or selected nodes with the locally saved Personal Access Token. Figma URLs are parsed automatically.",
    {
      fileKeyOrUrl: z.string().trim().min(1),
      nodeIds: z.array(z.string().trim().min(1)).max(40).optional(),
      depth: z.number().int().min(1).max(6).optional(),
      geometry: z.boolean().optional(),
      maxBytes: z.number().int().min(10_000).max(MAX_RESPONSE_BYTES).optional(),
    },
    async (input) => {
      try {
        const token = getConfiguredFigmaPat();
        const locator = parseFigmaLocator(input.fileKeyOrUrl, input.nodeIds);
        const nodeIds = locator.nodeIds;
        const endpoint = nodeIds.length > 0
          ? `files/${encodeURIComponent(locator.fileKey)}/nodes`
          : `files/${encodeURIComponent(locator.fileKey)}`;
        const payload = await figmaApiGet(endpoint, {
          ids: nodeIds.length > 0 ? nodeIds.join(",") : undefined,
          depth: input.depth ?? (nodeIds.length > 0 ? undefined : 2),
          geometry: input.geometry ? "paths" : undefined,
        }, token);
        return toTextToolResult({
          action: "figma_read_design",
          success: true,
          fileKey: locator.fileKey,
          nodeIds,
          result: capFigmaDesignPayload(payload, clampMaxBytes(input.maxBytes), {
            fileKey: locator.fileKey,
            fileKeyOrUrl: input.fileKeyOrUrl,
            currentNodeIds: nodeIds,
            currentDepth: input.depth ?? (nodeIds.length > 0 ? undefined : 2),
          }),
        });
      } catch (error) {
        return toTextToolResult({
          action: "figma_read_design",
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }, true);
      }
    },
  );

  const nodeIndexTool = tool(
    "figma_list_node_index",
    "List a compact Figma node index for progressive disclosure. Use this before reading a large file/frame, then drill into the smallest relevant nodeId.",
    {
      fileKeyOrUrl: z.string().trim().min(1),
      nodeIds: z.array(z.string().trim().min(1)).max(40).optional(),
      depth: z.number().int().min(1).max(6).optional(),
      query: z.string().trim().optional(),
      maxEntries: z.number().int().min(1).max(500).optional(),
      includeInvisible: z.boolean().optional(),
      maxBytes: z.number().int().min(10_000).max(MAX_RESPONSE_BYTES).optional(),
    },
    async (input) => {
      const action = "figma_list_node_index";
      try {
        const token = getConfiguredFigmaPat();
        const { locator, payload, source } = await fetchFigmaDesignPayload(token, input.fileKeyOrUrl, input.nodeIds, {
          depth: input.depth ?? 3,
        });
        const roots = extractDocumentNodes(payload, locator.nodeIds);
        const rawIndex = buildFigmaNodeIndex(roots, input.maxEntries ?? 160)
          .filter((entry) => input.includeInvisible === true || entry.visible !== false);
        const nodeIndex = filterFigmaNodeIndex(rawIndex, input.query);
        const recommendedNodeIds = pickRecommendedNodeIds(nodeIndex, locator.nodeIds);

        return toTextToolResult({
          action,
          success: true,
          fileKey: locator.fileKey,
          nodeIds: locator.nodeIds,
          source,
          query: input.query ?? null,
          result: capPayload({
            nodeIndex,
            recommendedNextInput: {
              fileKeyOrUrl: input.fileKeyOrUrl,
              nodeIds: recommendedNodeIds,
              depth: 3,
              maxNodes: 160,
            },
            nextStep: "Pick the smallest node that matches the requested UI area, then call figma_summarize_design or figma_read_design with that nodeId.",
          }, clampMaxBytes(input.maxBytes)),
        });
      } catch (error) {
        return toFigmaErrorResult(action, error);
      }
    },
  );
  const summarizeDesignTool = tool(
    "figma_summarize_design",
    "Summarize a Figma file or nodes into compact Agent-friendly design structure, layout, color, text, radius, shadow, and token notes.",
    {
      fileKeyOrUrl: z.string().trim().min(1),
      nodeIds: z.array(z.string().trim().min(1)).max(40).optional(),
      depth: z.number().int().min(1).max(8).optional(),
      maxNodes: z.number().int().min(1).max(2_000).optional(),
      includeInvisible: z.boolean().optional(),
      maxBytes: z.number().int().min(10_000).max(MAX_RESPONSE_BYTES).optional(),
    },
    async (input) => {
      const action = "figma_summarize_design";
      try {
        const token = getConfiguredFigmaPat();
        const { locator, payload, source } = await fetchFigmaDesignPayload(token, input.fileKeyOrUrl, input.nodeIds, {
          depth: input.depth ?? DEFAULT_SUMMARY_DEPTH,
        });
        const roots = extractDocumentNodes(payload, locator.nodeIds);
        const summary = buildDesignSummary(roots, {
          maxDepth: input.depth,
          maxNodes: input.maxNodes,
          includeInvisible: input.includeInvisible,
        });
        return toTextToolResult({
          action,
          success: true,
          fileKey: locator.fileKey,
          nodeIds: locator.nodeIds,
          source,
          result: capPayload(summary, clampMaxBytes(input.maxBytes)),
        });
      } catch (error) {
        return toFigmaErrorResult(action, error);
      }
    },
  );

  const extractDesignTokensTool = tool(
    "figma_extract_design_tokens",
    "Extract design-token candidates from a Figma file or nodes: color, typography, radius, spacing, and effects.",
    {
      fileKeyOrUrl: z.string().trim().min(1),
      nodeIds: z.array(z.string().trim().min(1)).max(40).optional(),
      depth: z.number().int().min(1).max(8).optional(),
      maxNodes: z.number().int().min(1).max(2_000).optional(),
      maxBytes: z.number().int().min(10_000).max(MAX_RESPONSE_BYTES).optional(),
    },
    async (input) => {
      const action = "figma_extract_design_tokens";
      try {
        const token = getConfiguredFigmaPat();
        const { locator, payload, source } = await fetchFigmaDesignPayload(token, input.fileKeyOrUrl, input.nodeIds, {
          depth: input.depth ?? DEFAULT_SUMMARY_DEPTH,
        });
        const roots = extractDocumentNodes(payload, locator.nodeIds);
        const tokens = extractDesignTokens(roots, clampInteger(input.maxNodes, 1, 2_000, DEFAULT_SUMMARY_MAX_NODES));
        return toTextToolResult({
          action,
          success: true,
          fileKey: locator.fileKey,
          nodeIds: locator.nodeIds,
          source,
          result: capPayload(tokens, clampMaxBytes(input.maxBytes)),
        });
      } catch (error) {
        return toFigmaErrorResult(action, error);
      }
    },
  );

  const designPlaybookTool = tool(
    "figma_get_design_playbook",
    "Return the built-in design playbook: design-system references, Laws of UX, token guidance, and domain-specific constraints.",
    {
      domain: z.enum(FIGMA_DESIGN_DOMAINS).optional(),
      includeSources: z.boolean().optional(),
      maxItems: z.number().int().min(1).max(20).optional(),
      maxBytes: z.number().int().min(10_000).max(MAX_RESPONSE_BYTES).optional(),
    },
    async (input) => {
      const action = "figma_get_design_playbook";
      try {
        const result = buildFigmaDesignPlaybook({
          domain: input.domain,
          includeSources: input.includeSources,
          maxItems: input.maxItems,
        });
        return toTextToolResult({
          action,
          success: true,
          result: capPayload(result, clampMaxBytes(input.maxBytes)),
        });
      } catch (error) {
        return toFigmaErrorResult(action, error);
      }
    },
  );

  const auditDesignTool = tool(
    "figma_audit_design",
    "Audit a Figma file or nodes for design-system fit, UX heuristics, token layering, componentization, accessibility, and implementation risks.",
    {
      fileKeyOrUrl: z.string().trim().min(1),
      nodeIds: z.array(z.string().trim().min(1)).max(40).optional(),
      domain: z.enum(FIGMA_DESIGN_DOMAINS).optional(),
      frameworks: z.array(z.enum(FIGMA_DESIGN_AUDIT_FRAMEWORKS)).max(FIGMA_DESIGN_AUDIT_FRAMEWORKS.length).optional(),
      depth: z.number().int().min(1).max(8).optional(),
      maxNodes: z.number().int().min(1).max(2_000).optional(),
      maxFindings: z.number().int().min(1).max(30).optional(),
      includePlaybook: z.boolean().optional(),
      includeInvisible: z.boolean().optional(),
      maxBytes: z.number().int().min(10_000).max(MAX_RESPONSE_BYTES).optional(),
    },
    async (input) => {
      const action = "figma_audit_design";
      try {
        const token = getConfiguredFigmaPat();
        const { locator, payload, source } = await fetchFigmaDesignPayload(token, input.fileKeyOrUrl, input.nodeIds, {
          depth: input.depth ?? DEFAULT_SUMMARY_DEPTH,
        });
        const roots = extractDocumentNodes(payload, locator.nodeIds);
        const summary = buildDesignSummary(roots, {
          maxDepth: input.depth,
          maxNodes: input.maxNodes,
          includeInvisible: input.includeInvisible,
        });
        const audit = buildFigmaDesignAudit(summary, {
          domain: input.domain,
          frameworks: input.frameworks,
          maxFindings: input.maxFindings,
          includePlaybook: input.includePlaybook,
        });
        return toTextToolResult({
          action,
          success: true,
          fileKey: locator.fileKey,
          nodeIds: locator.nodeIds,
          source,
          result: capPayload(audit, clampMaxBytes(input.maxBytes)),
        });
      } catch (error) {
        return toFigmaErrorResult(action, error);
      }
    },
  );

  const generateTailwindCodeTool = tool(
    "figma_generate_tailwind_code",
    "Generate a Tailwind HTML or React draft from Figma nodes. Treat the result as an editable scaffold, not a pixel-perfect final implementation.",
    {
      fileKeyOrUrl: z.string().trim().min(1),
      nodeIds: z.array(z.string().trim().min(1)).max(8).optional(),
      output: z.enum(FIGMA_CODE_OUTPUTS).optional(),
      componentName: z.string().trim().min(1).max(80).optional(),
      depth: z.number().int().min(1).max(8).optional(),
      maxNodes: z.number().int().min(1).max(800).optional(),
      includeInvisible: z.boolean().optional(),
      maxBytes: z.number().int().min(10_000).max(MAX_RESPONSE_BYTES).optional(),
    },
    async (input) => {
      const action = "figma_generate_tailwind_code";
      try {
        const token = getConfiguredFigmaPat();
        const { locator, payload, source } = await fetchFigmaDesignPayload(token, input.fileKeyOrUrl, input.nodeIds, {
          depth: input.depth ?? DEFAULT_SUMMARY_DEPTH,
        });
        const roots = extractDocumentNodes(payload, locator.nodeIds);
        const summary = buildDesignSummary(roots, {
          maxDepth: input.depth,
          maxNodes: input.maxNodes,
          includeInvisible: input.includeInvisible,
        });
        const output = input.output ?? "react";
        const code = generateTailwindCode(summary.nodes, output, input.componentName);
        return toTextToolResult(capPayload({
          action,
          success: true,
          fileKey: locator.fileKey,
          nodeIds: locator.nodeIds,
          source,
          output,
          code,
          stats: summary.stats,
          warnings: [
            ...summary.warnings,
            "Generated output is a Tailwind/React draft; reuse project components and tokens, then verify with screenshots.",
          ],
          tokens: summary.tokens,
          treePreview: summary.nodes,
        }, clampMaxBytes(input.maxBytes)));
      } catch (error) {
        return toFigmaErrorResult(action, error);
      }
    },
  );

  const imageUrlsTool = tool(
    "figma_get_image_urls",
    "Generate Figma image export URLs for selected nodes with the locally saved Personal Access Token.",
    {
      fileKeyOrUrl: z.string().trim().min(1),
      nodeIds: z.array(z.string().trim().min(1)).max(80).optional(),
      format: z.enum(["png", "jpg", "svg", "pdf"]).optional(),
      scale: z.number().min(0.01).max(4).optional(),
      svgIncludeId: z.boolean().optional(),
      maxBytes: z.number().int().min(10_000).max(MAX_RESPONSE_BYTES).optional(),
    },
    async (input) => {
      try {
        const token = getConfiguredFigmaPat();
        const locator = parseFigmaLocator(input.fileKeyOrUrl, input.nodeIds);
        if (locator.nodeIds.length === 0) {
          throw new Error("Missing nodeIds. Pass a Figma URL with node-id or provide nodeIds explicitly.");
        }
        const payload = await figmaApiGet(`images/${encodeURIComponent(locator.fileKey)}`, {
          ids: locator.nodeIds.join(","),
          format: input.format ?? "png",
          scale: input.scale,
          svg_include_id: input.svgIncludeId,
        }, token);
        return toTextToolResult({
          action: "figma_get_image_urls",
          success: true,
          fileKey: locator.fileKey,
          nodeIds: locator.nodeIds,
          result: capPayload(payload, clampMaxBytes(input.maxBytes)),
        });
      } catch (error) {
        return toTextToolResult({
          action: "figma_get_image_urls",
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }, true);
      }
    },
  );

  const imageFillsTool = tool(
    "figma_get_image_fills",
    "Read download URL mappings for image fills in a Figma file. URLs are temporary and require file_content:read scope.",
    {
      fileKeyOrUrl: z.string().trim().min(1),
      maxBytes: z.number().int().min(10_000).max(MAX_RESPONSE_BYTES).optional(),
    },
    async (input) => {
      const action = "figma_get_image_fills";
      try {
        const token = getConfiguredFigmaPat();
        const fileKey = getFigmaFileKey(input.fileKeyOrUrl);
        const payload = await figmaApiGet(`files/${encodeURIComponent(fileKey)}/images`, {}, token);
        return toTextToolResult({
          action,
          success: true,
          fileKey,
          result: capPayload(payload, clampMaxBytes(input.maxBytes)),
        });
      } catch (error) {
        return toFigmaErrorResult(action, error);
      }
    },
  );

  const fileVersionsTool = tool(
    "figma_list_file_versions",
    "Read Figma file version history. Requires file_versions:read scope.",
    {
      fileKeyOrUrl: z.string().trim().min(1),
      maxBytes: z.number().int().min(10_000).max(MAX_RESPONSE_BYTES).optional(),
    },
    async (input) => {
      const action = "figma_list_file_versions";
      try {
        const token = getConfiguredFigmaPat();
        const fileKey = getFigmaFileKey(input.fileKeyOrUrl);
        const payload = await figmaApiGet(`files/${encodeURIComponent(fileKey)}/versions`, {}, token);
        return toTextToolResult({
          action,
          success: true,
          fileKey,
          result: capPayload(payload, clampMaxBytes(input.maxBytes)),
        });
      } catch (error) {
        return toFigmaErrorResult(action, error);
      }
    },
  );

  const fileCommentsTool = tool(
    "figma_list_file_comments",
    "Read Figma file comments. Requires file_comments:read scope.",
    {
      fileKeyOrUrl: z.string().trim().min(1),
      asMarkdown: z.boolean().optional(),
      maxBytes: z.number().int().min(10_000).max(MAX_RESPONSE_BYTES).optional(),
    },
    async (input) => {
      const action = "figma_list_file_comments";
      try {
        const token = getConfiguredFigmaPat();
        const fileKey = getFigmaFileKey(input.fileKeyOrUrl);
        const payload = await figmaApiGet(`files/${encodeURIComponent(fileKey)}/comments`, {
          as_md: input.asMarkdown,
        }, token);
        return toTextToolResult({
          action,
          success: true,
          fileKey,
          result: capPayload(payload, clampMaxBytes(input.maxBytes)),
        });
      } catch (error) {
        return toFigmaErrorResult(action, error);
      }
    },
  );

  const fileLibraryTool = tool(
    "figma_list_file_library",
    "Read published components, component sets, and styles from a Figma file library. Requires library_content:read scope.",
    {
      fileKeyOrUrl: z.string().trim().min(1),
      include: z.array(z.enum(FIGMA_FILE_LIBRARY_KINDS)).max(FIGMA_FILE_LIBRARY_KINDS.length).optional(),
      maxBytes: z.number().int().min(10_000).max(MAX_RESPONSE_BYTES).optional(),
    },
    async (input) => {
      const action = "figma_list_file_library";
      try {
        const token = getConfiguredFigmaPat();
        const fileKey = getFigmaFileKey(input.fileKeyOrUrl);
        const include = input.include?.length ? [...new Set(input.include)] : [...FIGMA_FILE_LIBRARY_KINDS];
        const entries = await Promise.all(include.map(async (kind) => {
          const payload = await figmaApiGet(`files/${encodeURIComponent(fileKey)}/${kind}`, {}, token);
          return [kind, payload] as const;
        }));
        return toTextToolResult({
          action,
          success: true,
          fileKey,
          include,
          result: capPayload(Object.fromEntries(entries), clampMaxBytes(input.maxBytes)),
        });
      } catch (error) {
        return toFigmaErrorResult(action, error);
      }
    },
  );

  const fileVariablesTool = tool(
    "figma_get_file_variables",
    "Read Figma file variables. kind=local reads local/subscribed variables; kind=published reads published variables. Requires file_variables:read scope.",
    {
      fileKeyOrUrl: z.string().trim().min(1),
      kind: z.enum(FIGMA_VARIABLE_KINDS).optional(),
      maxBytes: z.number().int().min(10_000).max(MAX_RESPONSE_BYTES).optional(),
    },
    async (input) => {
      const action = "figma_get_file_variables";
      try {
        const token = getConfiguredFigmaPat();
        const fileKey = getFigmaFileKey(input.fileKeyOrUrl);
        const kind = input.kind ?? "local";
        const payload = await figmaApiGet(`files/${encodeURIComponent(fileKey)}/variables/${kind}`, {}, token);
        return toTextToolResult({
          action,
          success: true,
          fileKey,
          kind,
          result: capPayload(payload, clampMaxBytes(input.maxBytes)),
        });
      } catch (error) {
        return toFigmaErrorResult(action, error);
      }
    },
  );

  const devResourcesTool = tool(
    "figma_get_dev_resources",
    "Read Figma Dev Resources for a file, optionally filtered by nodeIds. Requires file_dev_resources:read scope.",
    {
      fileKeyOrUrl: z.string().trim().min(1),
      nodeIds: z.array(z.string().trim().min(1)).max(80).optional(),
      maxBytes: z.number().int().min(10_000).max(MAX_RESPONSE_BYTES).optional(),
    },
    async (input) => {
      const action = "figma_get_dev_resources";
      try {
        const token = getConfiguredFigmaPat();
        const locator = parseFigmaLocator(input.fileKeyOrUrl, input.nodeIds);
        const payload = await figmaApiGet(`files/${encodeURIComponent(locator.fileKey)}/dev_resources`, {
          node_ids: locator.nodeIds.length > 0 ? locator.nodeIds.join(",") : undefined,
        }, token);
        return toTextToolResult({
          action,
          success: true,
          fileKey: locator.fileKey,
          nodeIds: locator.nodeIds,
          result: capPayload(payload, clampMaxBytes(input.maxBytes)),
        });
      } catch (error) {
        return toFigmaErrorResult(action, error);
      }
    },
  );

  figmaRestMcpServer = createSdkMcpServer({
    name: FIGMA_REST_SERVER_NAME,
    version: FIGMA_REST_SERVER_VERSION,
    tools: [
      currentUserTool,
      fileMetadataTool,
      readDesignTool,
      nodeIndexTool,
      summarizeDesignTool,
      extractDesignTokensTool,
      designPlaybookTool,
      auditDesignTool,
      generateTailwindCodeTool,
      imageUrlsTool,
      imageFillsTool,
      fileVersionsTool,
      fileCommentsTool,
      fileLibraryTool,
      fileVariablesTool,
      devResourcesTool,
    ],
  });

  return figmaRestMcpServer;
}
