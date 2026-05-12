export type PhotoshopPlatform = "macos" | "windows" | "linux" | "unknown";
export type PhotoshopAutomationChannel = "uxp" | "script" | "com" | "applescript-bridge" | "parser" | "unavailable";
export type PhotoshopCapabilityState = "available" | "fallback" | "unavailable";
export type PhotoshopCodeTarget = "html-css-js" | "react-tailwind";
export type PhotoshopInferenceSource = "layer-name" | "geometry" | "text" | "style" | "manual" | "parser";
export type PhotoshopLayerKind = "group" | "text" | "shape" | "image" | "smart-object" | "artboard" | "unknown";
export type PhotoshopAssetFormat = "png" | "svg" | "webp" | "avif";
export type PhotoshopAssetUsage = "img" | "background" | "icon" | "decorative" | "unknown";

export type PhotoshopBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type NormalizedPhotoshopLayer = {
  id: string;
  name: string;
  kind: PhotoshopLayerKind;
  bounds?: PhotoshopBounds;
  visible?: boolean;
  text?: string;
  style?: Record<string, unknown>;
  children?: NormalizedPhotoshopLayer[];
};

export type NormalizedPhotoshopLayerTree = {
  document: {
    name: string;
    width: number;
    height: number;
  };
  layers: NormalizedPhotoshopLayer[];
};

export type PhotoshopEnvironmentResult = {
  platform: PhotoshopPlatform;
  photoshop: {
    available: boolean;
    running: boolean;
    version?: string;
    executablePath?: string;
    automationChannel: PhotoshopAutomationChannel;
  };
  parserFallback: {
    available: boolean;
    capabilities: string[];
    limitations: string[];
  };
  capabilityMatrix: {
    openDocument: PhotoshopCapabilityState;
    listLayers: PhotoshopCapabilityState;
    exportLayer: PhotoshopCapabilityState;
    controlledChange: PhotoshopCapabilityState;
  };
  recommendedMode: "photoshop" | "parser" | "unavailable";
  warnings: string[];
};

export type PhotoshopComponentManifest = {
  id: string;
  type: string;
  sourceLayerId?: string;
  text?: string;
  bounds: PhotoshopBounds;
  confidence: number;
  source: PhotoshopInferenceSource[];
  needsReview: boolean;
};

export type PhotoshopSectionManifest = {
  id: string;
  name: string;
  sourceLayerId?: string;
  bounds: PhotoshopBounds;
  confidence: number;
  source: PhotoshopInferenceSource[];
  needsReview: boolean;
  components: PhotoshopComponentManifest[];
};

export type PhotoshopAssetManifest = {
  id: string;
  sourceLayerId: string;
  path: string;
  format: PhotoshopAssetFormat;
  bounds?: PhotoshopBounds;
  usage: PhotoshopAssetUsage;
  scale: number[];
  confidence: number;
};

export type PhotoshopWebManifest = {
  schemaVersion: "1.0";
  source: {
    filePath: string;
    documentId?: string;
    platform: PhotoshopPlatform;
    photoshopVersion?: string;
    automationChannel: PhotoshopAutomationChannel;
    fallbackUsed: boolean;
    createdAt: string;
  };
  page: {
    name: string;
    width: number;
    height: number;
    artboards: unknown[];
    sections: PhotoshopSectionManifest[];
  };
  tokens: {
    colors: unknown[];
    typography: unknown[];
    spacing: unknown[];
    radii: unknown[];
    effects: unknown[];
  };
  assets: PhotoshopAssetManifest[];
  codeTargets: PhotoshopCodeTarget[];
  warnings: string[];
  changeLog: unknown[];
};

export type PhotoshopAssetExportPlan = {
  exportRoot: string;
  assets: PhotoshopAssetManifest[];
  warnings: string[];
};

export type PhotoshopGeneratedFile = {
  path: string;
  language: "html" | "css" | "javascript" | "typescript" | "tsx" | "json" | "markdown";
  content: string;
};

export type PhotoshopCodeGenerationResult = {
  target: PhotoshopCodeTarget;
  files: PhotoshopGeneratedFile[];
  warnings: string[];
};

export type PhotoshopVisualRepairPlan = {
  referenceImagePath?: string;
  candidateUrl?: string;
  manifestSummary: {
    pageName: string;
    sectionCount: number;
    assetCount: number;
  };
  steps: Array<{
    order: number;
    tool: string;
    purpose: string;
  }>;
  warnings: string[];
};

export type PhotoshopProjectManifest = {
  schemaVersion: "1.0";
  pages: Array<{
    name: string;
    sourceFilePath: string;
    width: number;
    height: number;
    sectionCount: number;
    assetCount: number;
  }>;
  sharedAssets: PhotoshopAssetManifest[];
  sharedComponents: Array<{
    id: string;
    type: string;
    occurrences: number;
    pages: string[];
  }>;
  codeTargets: PhotoshopCodeTarget[];
  warnings: string[];
};

export type PhotoshopControlOperation =
  | { type: "rename-layer"; layerId: string; nextName: string }
  | { type: "write-metadata"; layerId: string; key: string; value: string }
  | { type: "create-slice-marker"; layerId: string; markerName: string };

export type PhotoshopControlledChangeInput = {
  workspaceRoot: string;
  filePath: string;
  dryRun?: boolean;
  confirmed?: boolean;
  operations: PhotoshopControlOperation[];
  allowedRoots?: string[];
  now?: Date;
};
