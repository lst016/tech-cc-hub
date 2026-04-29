export type BrowserWorkbenchVisibilityInput = {
  active: boolean;
  hasBrowserTab: boolean;
  occluded: boolean;
};

export function shouldAttachBrowserWorkbench(input: BrowserWorkbenchVisibilityInput): boolean {
  return input.active && input.hasBrowserTab && !input.occluded;
}
