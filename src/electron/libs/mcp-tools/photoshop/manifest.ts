import { z } from "zod";

import type {
  PhotoshopAutomationChannel,
  PhotoshopPlatform,
  PhotoshopWebManifest,
} from "./types.js";

export const photoshopBoundsSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().nonnegative(),
  height: z.number().nonnegative(),
});

export const photoshopInferenceSourceSchema = z.enum(["layer-name", "geometry", "text", "style", "manual", "parser"]);
export const photoshopPlatformSchema = z.enum(["macos", "windows", "linux", "unknown"]);
export const photoshopAutomationChannelSchema = z.enum(["uxp", "script", "com", "applescript-bridge", "parser", "unavailable"]);
export const photoshopCodeTargetSchema = z.enum(["html-css-js", "react-tailwind"]);

export const photoshopComponentSchema = z.object({
  id: z.string().trim().min(1),
  type: z.string().trim().min(1),
  sourceLayerId: z.string().trim().min(1).optional(),
  text: z.string().optional(),
  bounds: photoshopBoundsSchema,
  confidence: z.number().min(0).max(1),
  source: z.array(photoshopInferenceSourceSchema).min(1),
  needsReview: z.boolean(),
});

export const photoshopSectionSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  sourceLayerId: z.string().trim().min(1).optional(),
  bounds: photoshopBoundsSchema,
  confidence: z.number().min(0).max(1),
  source: z.array(photoshopInferenceSourceSchema).min(1),
  needsReview: z.boolean(),
  components: z.array(photoshopComponentSchema),
});

export const photoshopAssetSchema = z.object({
  id: z.string().trim().min(1),
  sourceLayerId: z.string().trim().min(1),
  path: z.string().trim().min(1),
  format: z.enum(["png", "svg", "webp", "avif"]),
  bounds: photoshopBoundsSchema.optional(),
  usage: z.enum(["img", "background", "icon", "decorative", "unknown"]),
  scale: z.array(z.number().positive()).min(1),
  confidence: z.number().min(0).max(1),
});

export const photoshopWebManifestSchema = z.object({
  schemaVersion: z.literal("1.0"),
  source: z.object({
    filePath: z.string().trim().min(1),
    documentId: z.string().trim().min(1).optional(),
    platform: photoshopPlatformSchema,
    photoshopVersion: z.string().trim().min(1).optional(),
    automationChannel: photoshopAutomationChannelSchema,
    fallbackUsed: z.boolean(),
    createdAt: z.string().trim().min(1),
  }),
  page: z.object({
    name: z.string().trim().min(1),
    width: z.number().positive(),
    height: z.number().positive(),
    artboards: z.array(z.unknown()),
    sections: z.array(photoshopSectionSchema),
  }),
  tokens: z.object({
    colors: z.array(z.unknown()),
    typography: z.array(z.unknown()),
    spacing: z.array(z.unknown()),
    radii: z.array(z.unknown()),
    effects: z.array(z.unknown()),
  }),
  assets: z.array(photoshopAssetSchema),
  codeTargets: z.array(photoshopCodeTargetSchema).min(1),
  warnings: z.array(z.string()),
  changeLog: z.array(z.unknown()),
});

export function validatePhotoshopWebManifest(value: unknown) {
  return photoshopWebManifestSchema.safeParse(value);
}

export function createEmptyPhotoshopWebManifest(input: {
  filePath: string;
  pageName: string;
  width: number;
  height: number;
  platform?: PhotoshopPlatform;
  automationChannel?: PhotoshopAutomationChannel;
  fallbackUsed?: boolean;
  createdAt?: string;
}): PhotoshopWebManifest {
  return {
    schemaVersion: "1.0",
    source: {
      filePath: input.filePath,
      platform: input.platform ?? "unknown",
      automationChannel: input.automationChannel ?? "parser",
      fallbackUsed: input.fallbackUsed ?? true,
      createdAt: input.createdAt ?? new Date().toISOString(),
    },
    page: {
      name: input.pageName,
      width: input.width,
      height: input.height,
      artboards: [],
      sections: [],
    },
    tokens: {
      colors: [],
      typography: [],
      spacing: [],
      radii: [],
      effects: [],
    },
    assets: [],
    codeTargets: ["html-css-js", "react-tailwind"],
    warnings: [],
    changeLog: [],
  };
}
