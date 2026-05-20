import type { BrowserWorkbenchElementInfoResult } from "../../browser-manager.js";

export type ElementBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ElementCaptureRegion = ElementBox & {
  reason?: string;
};

export function readElementBoxFromInfoResult(result: BrowserWorkbenchElementInfoResult | undefined): ElementBox | null {
  const value = result?.value;
  if (isElementBox(value)) {
    return value;
  }
  const boundingBox = result?.node?.boundingBox;
  if (isElementBox(boundingBox)) {
    return boundingBox;
  }
  return null;
}

export function buildPaddedRegionFromElementBox(box: ElementBox, padding = 0): ElementCaptureRegion {
  const safePadding = Number.isFinite(padding) ? Math.max(0, padding) : 0;
  return {
    x: box.x - safePadding,
    y: box.y - safePadding,
    width: box.width + safePadding * 2,
    height: box.height + safePadding * 2,
    reason: "element bounding box",
  };
}

function isElementBox(value: unknown): value is ElementBox {
  if (!isRecord(value)) {
    return false;
  }
  const { x, y, width, height } = value;
  return (
    typeof x === "number" && Number.isFinite(x) &&
    typeof y === "number" && Number.isFinite(y) &&
    typeof width === "number" && Number.isFinite(width) && width > 0 &&
    typeof height === "number" && Number.isFinite(height) && height > 0
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
