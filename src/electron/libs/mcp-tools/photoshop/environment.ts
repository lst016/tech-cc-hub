import type {
  PhotoshopAutomationChannel,
  PhotoshopEnvironmentResult,
  PhotoshopPlatform,
} from "./types.js";

export type PhotoshopEnvironmentHost = {
  platform?: NodeJS.Platform;
  findPhotoshop: () => Promise<{
    running?: boolean;
    version?: string;
    executablePath?: string;
    channel?: PhotoshopAutomationChannel;
  } | null>;
  canUseParserFallback: () => Promise<boolean>;
};

function normalizePlatform(platform: NodeJS.Platform | undefined): PhotoshopPlatform {
  if (platform === "darwin") return "macos";
  if (platform === "win32") return "windows";
  if (platform === "linux") return "linux";
  return "unknown";
}

export const defaultPhotoshopEnvironmentHost: PhotoshopEnvironmentHost = {
  platform: process.platform,
  findPhotoshop: async () => null,
  canUseParserFallback: async () => true,
};

export async function checkPhotoshopEnvironment(
  host: PhotoshopEnvironmentHost = defaultPhotoshopEnvironmentHost,
): Promise<PhotoshopEnvironmentResult> {
  const platform = normalizePlatform(host.platform ?? process.platform);
  const [photoshop, parserAvailable] = await Promise.all([
    host.findPhotoshop(),
    host.canUseParserFallback(),
  ]);
  const photoshopAvailable = Boolean(photoshop);
  const automationChannel = photoshop?.channel ?? "unavailable";
  const parserState = parserAvailable ? "fallback" : "unavailable";

  return {
    platform,
    photoshop: {
      available: photoshopAvailable,
      running: Boolean(photoshop?.running),
      version: photoshop?.version,
      executablePath: photoshop?.executablePath,
      automationChannel,
    },
    parserFallback: {
      available: parserAvailable,
      capabilities: parserAvailable ? ["layer-tree", "bounds", "basic-text", "manifest-input"] : [],
      limitations: parserAvailable
        ? ["smart-object-rendering", "complex-effects", "blend-mode-fidelity", "font-rendering"]
        : ["parser-unavailable"],
    },
    capabilityMatrix: {
      openDocument: photoshopAvailable ? "available" : parserState,
      listLayers: photoshopAvailable ? "available" : parserState,
      exportLayer: photoshopAvailable ? "available" : "unavailable",
      controlledChange: photoshopAvailable ? "available" : "unavailable",
    },
    recommendedMode: photoshopAvailable ? "photoshop" : parserAvailable ? "parser" : "unavailable",
    warnings: [
      ...(!photoshopAvailable ? ["Photoshop automation is unavailable; parser fallback can only provide reduced-fidelity layer data."] : []),
      ...(platform === "linux" ? ["Photoshop automation is only planned for Windows and macOS."] : []),
    ],
  };
}
