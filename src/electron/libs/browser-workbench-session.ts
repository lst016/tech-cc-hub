export const BROWSER_WORKBENCH_PARTITION = "persist:tech-cc-hub-browser";

export type BrowserWorkbenchWebPreferences = {
  contextIsolation: true;
  nodeIntegration: false;
  sandbox: true;
  partition: string;
  preload?: string;
};

export function buildBrowserWorkbenchWebPreferences(preload?: string): BrowserWorkbenchWebPreferences {
  return {
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    partition: BROWSER_WORKBENCH_PARTITION,
    ...(preload ? { preload } : {}),
  };
}
