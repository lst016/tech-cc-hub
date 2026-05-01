export const PROMPT_FOCUS_EVENT = "techcc:prompt-focus";
export const PREVIEW_OPEN_FILE_EVENT = "techcc:preview-open-file";
export const OPEN_BROWSER_WORKBENCH_URL_EVENT = "tech-cc-hub:open-browser-workbench-url";

export type PreviewOpenFileDetail = {
  filePath: string;
  startLine?: number;
};

export type OpenBrowserWorkbenchUrlDetail = {
  url: string;
};
