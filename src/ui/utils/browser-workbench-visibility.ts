export type BrowserWorkbenchVisibilityInput = {
  active: boolean;
  hasBrowserTab: boolean;
  occluded: boolean;
};

export type BrowserWorkbenchSurfaceBounds = {
  width: number;
  height: number;
};

export const BROWSER_WORKBENCH_OCCLUDER_SELECTOR = [
  '[aria-modal="true"]',
  '[role="dialog"]',
  '[role="alertdialog"]',
  "dialog[open]",
  '[data-browser-workbench-occluder="true"]',
  '[class~="fixed"][class~="inset-0"]',
].join(", ");

type BrowserWorkbenchOcclusionRoot = Pick<ParentNode, "querySelectorAll">;
type BrowserWorkbenchOccluderVisibility = (element: Element) => boolean;

function isVisibleBrowserWorkbenchOccluder(element: Element): boolean {
  if (!(element instanceof HTMLElement)) return false;
  if (element.hidden || element.closest('[hidden], [aria-hidden="true"]')) return false;

  const view = element.ownerDocument.defaultView;
  const style = view?.getComputedStyle(element);
  if (!style || style.display === "none" || style.visibility === "hidden") return false;
  return element.getClientRects().length > 0;
}

export function hasVisibleBrowserWorkbenchOccluder(
  root: BrowserWorkbenchOcclusionRoot,
  isVisible: BrowserWorkbenchOccluderVisibility = isVisibleBrowserWorkbenchOccluder,
): boolean {
  return Array.from(root.querySelectorAll(BROWSER_WORKBENCH_OCCLUDER_SELECTOR)).some(isVisible);
}

export function observeBrowserWorkbenchOcclusion(
  onChange: (occluded: boolean) => void,
  root: Document = document,
): () => void {
  let previousValue: boolean | undefined;
  const emitIfChanged = () => {
    const nextValue = hasVisibleBrowserWorkbenchOccluder(root);
    if (nextValue === previousValue) return;
    previousValue = nextValue;
    onChange(nextValue);
  };

  emitIfChanged();
  const observer = new MutationObserver(emitIfChanged);
  observer.observe(root.body ?? root.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: [
      "aria-hidden",
      "aria-modal",
      "class",
      "data-browser-workbench-occluder",
      "hidden",
      "open",
      "role",
      "style",
    ],
  });

  return () => observer.disconnect();
}

export function shouldAttachBrowserWorkbench(input: BrowserWorkbenchVisibilityInput): boolean {
  return input.active && input.hasBrowserTab && !input.occluded;
}

export function hasRenderableBrowserWorkbenchBounds(bounds: BrowserWorkbenchSurfaceBounds): boolean {
  return Number.isFinite(bounds.width) &&
    Number.isFinite(bounds.height) &&
    Math.round(bounds.width) > 0 &&
    Math.round(bounds.height) > 0;
}
