// 生图 MCP 工具：暴露 image_generate 给主对话 Agent。
// 详见 .omx/plans/2026-07-10-image-generation-integration.md §8。
// 每次 Runner 创建全新 MCP Server 实例，遵循现有工厂约束（不缓存 connection-scoped 实例）。
import {
  createSdkMcpServer,
  tool,
  type McpSdkServerConfigWithInstance,
} from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

import { toTextToolResult } from "./tool-result.js";
import {
  generateImages,
  type ImageGenerationRequest,
  type ImageGenerationToolResult,
} from "../image/image-generation-client.js";
import type { ImageGenerationRouteConfig } from "../../../shared/models/image-generation-routing.js";
import type { ApiConfig } from "../../types.js";

export const IMAGE_GENERATION_TOOL_NAMES = ["image_generate"] as const;

const IMAGE_GENERATION_MCP_SERVER_NAME = "tech-cc-hub-image";
const IMAGE_GENERATION_MCP_SERVER_VERSION = "1.0.0";

const IMAGE_GENERATE_SCHEMA = {
  prompt: z.string().min(1).max(8000).describe("生图或编辑图片的文本描述，最大 8000 字符。"),
  action: z.enum(["auto", "generate", "edit"]).optional().describe(
    "auto=根据是否传参考图自动选择；generate=纯文生图；edit=基于参考图编辑。默认 auto。",
  ),
  referenceImagePaths: z.array(z.string()).max(4).optional().describe(
    "参考图绝对路径数组，最多 4 张，每张 ≤20MiB，仅支持 PNG/JPEG/WebP。仅分析截图时不要传，改用 design_inspect_image。",
  ),
  maskPath: z.string().optional().describe("可选蒙版图路径，用于局部编辑。首版未实现蒙版编辑器，API 层已预留。"),
  size: z.string().optional().describe("输出尺寸，如 1024x1024、1536x1024、auto。"),
  quality: z.enum(["auto", "low", "medium", "high"]).optional().describe("输出质量。"),
  outputFormat: z.enum(["png", "jpeg", "webp"]).optional().describe("输出格式。"),
  background: z.enum(["auto", "opaque", "transparent"]).optional().describe("背景模式。部分模型不支持 transparent。"),
  count: z.number().int().min(1).max(4).optional().describe("生成数量，1-4，默认 1。不自动批量生成大量图片。"),
};

// 会话上下文注入点：runner 在每次构造 MCP Server 时调用 setImageGenerationSessionContext。
type ImageGenerationSessionContext = {
  sessionId: string;
  cwd?: string;
  selectedConfig: ImageGenerationRouteConfig | null;
  enabledConfigs: ImageGenerationRouteConfig[];
};

let sessionContextRef: ImageGenerationSessionContext | null = null;

export function setImageGenerationSessionContext(context: ImageGenerationSessionContext | null): void {
  sessionContextRef = context;
}

/**
 * 把运行时 ApiConfig 转成生图路由需要的精简结构。
 * 仅保留路由解析必要字段，不携带任何额外敏感信息。
 */
export function toImageGenerationRouteConfig(config: ApiConfig | null | undefined): ImageGenerationRouteConfig | null {
  if (!config) return null;
  return {
    id: config.id,
    name: config.name,
    provider: config.provider,
    baseURL: config.baseURL,
    apiKey: config.apiKey,
    imageGenerationModel: config.imageGenerationModel,
    models: (config.models ?? []).map((model: { name: string; routingWeight?: number }) => ({ name: model.name, routingWeight: model.routingWeight })),
  };
}

function ensureContext(): ImageGenerationSessionContext | null {
  return sessionContextRef;
}

const imageGenerateHandler = tool(
  "image_generate",
  "生成或编辑图片。用户要求画图、生成视觉资产、做海报/插画/banner/sprite，或基于参考图编辑（替换背景、改颜色、修改主体）时调用。"
    + "无参考图走文生图，有参考图走编辑。结果图片落盘到本地，返回 JSON 路径与元数据，不返回 base64。"
    + "仅分析截图时使用 design_inspect_image，不要调用本工具。用户附带参考图时传完整 storagePath 绝对路径，不能传占位文件名。"
    + "生成成功后在最终回答中简短说明结果，不复制 base64。未获得明确生成/编辑意图时不要主动产生付费图片请求。",
  IMAGE_GENERATE_SCHEMA,
  async (input): Promise<ReturnType<typeof toTextToolResult>> => {
    try {
      const ctx = ensureContext();
      if (!ctx) {
        const result: ImageGenerationToolResult = {
          action: "image_generate",
          success: false,
          code: "NOT_CONFIGURED",
          message: "生图工具未初始化会话上下文。请重新发起对话。",
        };
        return toTextToolResult(result, true);
      }

      const request: ImageGenerationRequest = {
        prompt: input.prompt,
        action: input.action,
        referenceImagePaths: input.referenceImagePaths,
        maskPath: input.maskPath,
        size: input.size as ImageGenerationRequest["size"] | undefined,
        quality: input.quality,
        outputFormat: input.outputFormat,
        background: input.background,
        count: input.count,
      };

      const result = await generateImages({
        sessionId: ctx.sessionId,
        cwd: ctx.cwd,
        request,
        context: {
          selectedConfig: ctx.selectedConfig,
          enabledConfigs: ctx.enabledConfigs,
        },
      });

      // 错误结果用 isError=true 标记，但仍然返回结构化 JSON 供 Renderer 解析
      return toTextToolResult(result, !result.success);
    } catch (error) {
      const result: ImageGenerationToolResult = {
        action: "image_generate",
        success: false,
        code: "UPSTREAM_ERROR",
        message: `生图工具执行失败：${error instanceof Error ? error.message : String(error)}`,
      };
      return toTextToolResult(result, true);
    }
  },
);

export function getImageGenerationMcpServer(): McpSdkServerConfigWithInstance {
  return createSdkMcpServer({
    name: IMAGE_GENERATION_MCP_SERVER_NAME,
    version: IMAGE_GENERATION_MCP_SERVER_VERSION,
    tools: [imageGenerateHandler],
  });
}
