export const BROWSER_WORKBENCH_PARTITION = "persist:tech-cc-hub-browser";

export type BrowserWorkbenchWebPreferences = {
  contextIsolation: true;
  nodeIntegration: false;
  sandbox: true;
  partition: string;
};

export function buildBrowserWorkbenchWebPreferences(): BrowserWorkbenchWebPreferences {
  return {
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    partition: BROWSER_WORKBENCH_PARTITION,
  };
}
