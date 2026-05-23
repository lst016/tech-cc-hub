export type BrowserWorkbenchBoundsLike = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function sanitizeBrowserWorkbenchBounds(bounds: BrowserWorkbenchBoundsLike): BrowserWorkbenchBoundsLike {
  return {
    x: Math.max(0, Math.round(bounds.x)),
    y: Math.max(0, Math.round(bounds.y)),
    width: Math.max(0, Math.round(bounds.width)),
    height: Math.max(0, Math.round(bounds.height)),
  };
}

export function shouldDetachBrowserWorkbenchForBounds(bounds: Pick<BrowserWorkbenchBoundsLike, "width" | "height">): boolean {
  return Math.round(bounds.width) <= 0 || Math.round(bounds.height) <= 0;
}
