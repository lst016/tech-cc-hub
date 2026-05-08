export const PROMPT_FOCUS_EVENT = "techcc:prompt-focus";
export const PROMPT_SUBMIT_EVENT = "techcc:prompt-submit";
export const PROMPT_SENT_EVENT = "techcc:prompt-sent";
export const PREVIEW_OPEN_FILE_EVENT = "techcc:preview-open-file";
export const OPEN_BROWSER_WORKBENCH_URL_EVENT = "tech-cc-hub:open-browser-workbench-url";
export const ADD_PROMPT_ATTACHMENT_EVENT = "techcc:add-prompt-attachment";

export type PreviewOpenFileDetail = {
  filePath: string;
  startLine?: number;
};

export type OpenBrowserWorkbenchUrlDetail = {
  url: string;
};

export type AddPromptAttachmentDetail = {
  kind: "image";
  name?: string;
  mimeType: string;
  data: string;
  preview?: string;
  size?: number;
};
