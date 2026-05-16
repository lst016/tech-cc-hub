# src/electron/libs/mcp-tools/figma-rest.ts

> 模块：`mcp-tools` · 语言：`typescript` · 行数：1467

## 文件职责

源码文件。运行信号：mcp tool: figma_get_current_user、mcp tool: figma_get_file_metadata、mcp tool: figma_read_design、mcp tool: figma_list_node_index、mcp tool: figma_match_ui_nodes；依赖：@anthropic-ai/claude-agent-sdk、@modelcontextprotocol/sdk/types.js、zod、../config-store.js、../figma-official-plugin.js

## 运行信号

- `mcp tool: figma_get_current_user`
- `mcp tool: figma_get_file_metadata`
- `mcp tool: figma_read_design`
- `mcp tool: figma_list_node_index`
- `mcp tool: figma_match_ui_nodes`
- `mcp tool: figma_summarize_design`
- `mcp tool: figma_extract_design_tokens`
- `mcp tool: figma_get_design_playbook`
- `mcp tool: figma_audit_design`
- `mcp tool: figma_generate_tailwind_code`
- `mcp tool: figma_get_image_urls`
- `mcp tool: figma_get_image_fills`
- `mcp tool: figma_list_file_versions`
- `mcp tool: figma_list_file_comments`
- `mcp tool: figma_list_file_library`
- `mcp tool: figma_get_file_variables`
- `mcp tool: figma_get_dev_resources`

## 关键符号

- `isRecord@114 - mcp tool: figma_get_current_user, mcp tool: figma_get_file_metadata, mcp tool: figma_read_design`
- `getConfiguredFigmaPat@118 - mcp tool: figma_get_current_user, mcp tool: figma_get_file_metadata, mcp tool: figma_read_design`
- `clampMaxBytes@131 - mcp tool: figma_get_current_user, mcp tool: figma_get_file_metadata, mcp tool: figma_read_design`
- `figmaApiGet@138 - mcp tool: figma_get_current_user, mcp tool: figma_get_file_metadata, mcp tool: figma_read_design`
- `parseJsonBody@165 - mcp tool: figma_get_current_user, mcp tool: figma_get_file_metadata, mcp tool: figma_read_design`
- `getFigmaApiErrorMessage@176 - mcp tool: figma_get_current_user, mcp tool: figma_get_file_metadata, mcp tool: figma_read_design`
- `capPayload@185 - mcp tool: figma_get_current_user, mcp tool: figma_get_file_metadata, mcp tool: figma_read_design`
- `capFigmaDesignPayload@198 - mcp tool: figma_get_current_user, mcp tool: figma_get_file_metadata, mcp tool: figma_read_design`
- `getFigmaFileKey@244 - mcp tool: figma_get_current_user, mcp tool: figma_get_file_metadata, mcp tool: figma_read_design`
- `toFigmaErrorResult@248 - mcp tool: figma_get_current_user, mcp tool: figma_get_file_metadata, mcp tool: figma_read_design`
- `countRecordKeys@256 - mcp tool: figma_get_current_user, mcp tool: figma_get_file_metadata, mcp tool: figma_read_design`
- `summarizeFileMetadataFromDocument@260 - mcp tool: figma_get_current_user, mcp tool: figma_get_file_metadata, mcp tool: figma_read_design`
- `fetchFigmaDesignPayload@297 - mcp tool: figma_get_current_user, mcp tool: figma_get_file_metadata, mcp tool: figma_read_design`
- `extractDocumentNodes@323 - mcp tool: figma_get_current_user, mcp tool: figma_get_file_metadata, mcp tool: figma_read_design`
- `buildDesignSummary@340 - mcp tool: figma_get_current_user, mcp tool: figma_get_file_metadata, mcp tool: figma_read_design`
- `compactDesignNode@370 - mcp tool: figma_get_current_user, mcp tool: figma_get_file_metadata, mcp tool: figma_read_design`

## 依赖输入

- `@anthropic-ai/claude-agent-sdk`
- `@modelcontextprotocol/sdk/types.js`
- `zod`
- `../config-store.js`
- `../figma-official-plugin.js`
- `./figma-design-intelligence.js`
- `./figma-locator.js`
- `./figma-node-index.js`
- `./figma-ui-node-matcher.js`
- `./tool-result.js`

## 对外暴露

- `getFigmaRestMcpServer`
- `FIGMA_REST_TOOL_NAMES`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
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
import {
  parseFigmaLocator,
  type FigmaLocator,
} from "./figma-locator.js";
import {
  buildFigmaNodeIndex,
  filterFigmaNodeIndex,
  pickRecommendedNodeIds,
} from "./figma-node-index.js";
import {
  matchUiNodesToFigmaNodes,
  type FigmaUiMatchNode,
} from "./figma-ui-node-matcher.js";
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
const figmaUiBoundsSchema = z.object({
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
}).passthrough();
const figmaUiNodeSchema = z.object({
  ref: z.string().optional(),
  index: z.number().int().optional(),
  tagName: z.string().optional(),
  role: z.string().optional(),
  name: z.string().optional(),
  text: z.string().optional(),
  ariaLabel: z.string().optional(),
  value: z.string().optional(),
  placeholder: z.string().optional(),
  title: z.string().optional(),
  selector: z.string().optional(),
  path: z.string().optional(),
  xpath: z.string().optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
  boundingBox: figmaUiBoundsSchema.optional(),
  box: figmaUiBoundsSchema.optional(),
  componentStack: z.array(z.string()).max(20).optional(),
  context: z.object({
    ancestorChain: z.array(z.string()).max(20).optional(),
    nearbyText: z.string().optional(),
  }).passthrough().optional(),
}).passthrough();

let figmaRestMcpServer: McpSdkServerConfigWithInstance | null = null;

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
... (truncated)
```
