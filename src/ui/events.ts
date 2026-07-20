export const PROMPT_FOCUS_EVENT = "techcc:prompt-focus";
export const PROMPT_SUBMIT_EVENT = "techcc:prompt-submit";
export const PROMPT_SENT_EVENT = "techcc:prompt-sent";
export const PROMPT_APPEND_RESULT_EVENT = "techcc:prompt-append-result";
export const PROMPT_FORK_RESULT_EVENT = "techcc:prompt-fork-result";
export const FORK_ASSISTANT_MESSAGE_EVENT = "techcc:fork-assistant-message";
export const PREVIEW_OPEN_FILE_EVENT = "techcc:preview-open-file";
export const OPEN_VISUALIZATION_PREVIEW_EVENT = "techcc:open-visualization-preview";
export const OPEN_BROWSER_WORKBENCH_URL_EVENT = "tech-cc-hub:open-browser-workbench-url";
export const OPEN_WORKSPACE_PLUGIN_EVENT = "tech-cc-hub:open-workspace-plugin";
export const OPEN_SIDE_CONVERSATION_EVENT = "tech-cc-hub:open-side-conversation";
export const ADD_PROMPT_ATTACHMENT_EVENT = "techcc:add-prompt-attachment";

export type PreviewOpenFileDetail = {
  filePath: string;
  startLine?: number;
  endLine?: number;
  revealFirstChange?: boolean;
};

export type OpenVisualizationPreviewDetail = {
  sessionId: string;
  fileName: string;
  title: string;
  onFollowUp?: (request: { prompt: string; title?: string }) => void | Promise<void>;
};

export type ForkAssistantMessageDetail = {
  sessionId: string;
  messageId: string;
};

export type OpenBrowserWorkbenchUrlDetail = {
  url: string;
};

export type OpenWorkspacePluginDetail = {
  pluginId: string;
};

export type AddPromptAttachmentDetail = {
  kind: "image";
  name?: string;
  mimeType: string;
  data: string;
  preview?: string;
  size?: number;
};

export type PromptAppendResultDetail = {
  sessionId: string;
  requestId: string;
  success: boolean;
  error?: string;
};

export type PromptForkResultDetail = {
  sourceSessionId: string;
  requestId: string;
  success: boolean;
  forkedSessionId?: string;
  error?: string;
};
