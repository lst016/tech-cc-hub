type BrowserAnnotationBridge = {
  clearBrowserWorkbenchAnnotations?: (sessionId?: string) => Promise<unknown>;
  setBrowserWorkbenchAnnotationMode?: (enabled: boolean, sessionId?: string) => Promise<unknown>;
};

export async function resetBrowserWorkbenchAnnotationState(
  bridge: BrowserAnnotationBridge | undefined,
  sessionId?: string,
): Promise<void> {
  try {
    await bridge?.clearBrowserWorkbenchAnnotations?.(sessionId);
  } finally {
    await bridge?.setBrowserWorkbenchAnnotationMode?.(false, sessionId);
  }
}
