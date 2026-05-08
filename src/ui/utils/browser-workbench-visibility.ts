export type BrowserWorkbenchVisibilityInput = {
  active: boolean;
  hasBrowserTab: boolean;
  occluded: boolean;
};

export type BrowserWorkbenchSurfaceBounds = {
  width: number;
  height: number;
};

export function shouldAttachBrowserWorkbench(input: BrowserWorkbenchVisibilityInput): boolean {
  return input.active && input.hasBrowserTab && !input.occluded;
}

export function hasRenderableBrowserWorkbenchBounds(bounds: BrowserWorkbenchSurfaceBounds): boolean {
  return Number.isFinite(bounds.width) &&
    Number.isFinite(bounds.height) &&
    Math.round(bounds.width) > 0 &&
    Math.round(bounds.height) > 0;
}
