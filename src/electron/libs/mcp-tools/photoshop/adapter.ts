import type {
  NormalizedPhotoshopLayerTree,
  PhotoshopEnvironmentResult,
} from "./types.js";

export type PhotoshopControlAdapter = {
  checkEnvironment(): Promise<PhotoshopEnvironmentResult>;
  openDocument(input: { filePath: string }): Promise<{ documentId: string; filePath: string }>;
  listLayers(input: { documentId: string }): Promise<NormalizedPhotoshopLayerTree>;
  measureLayer(input: { documentId: string; layerId: string }): Promise<Record<string, unknown>>;
  exportLayer(input: { documentId: string; layerId: string; outputPath: string }): Promise<Record<string, unknown>>;
  exportDocumentPreview(input: { documentId: string; outputPath: string }): Promise<Record<string, unknown>>;
  applyControlledChange(input: Record<string, unknown>): Promise<Record<string, unknown>>;
};

export function createUnavailablePhotoshopAdapter(reason = "Photoshop platform automation spike has not selected an implementation channel yet."): PhotoshopControlAdapter {
  const unavailable = async () => {
    throw new Error(reason);
  };

  return {
    checkEnvironment: unavailable,
    openDocument: unavailable,
    listLayers: unavailable,
    measureLayer: unavailable,
    exportLayer: unavailable,
    exportDocumentPreview: unavailable,
    applyControlledChange: unavailable,
  };
}
