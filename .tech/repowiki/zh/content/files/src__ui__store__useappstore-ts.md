# src/ui/store/useAppStore.ts

> 模块：`ui-shell` · 语言：`typescript` · 行数：1082

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `getCodeReferenceSessionKey@65`
- `createSession@169`
- `hydrateWorkflowView@181`
- `getEnabledProfiles@199`
- `getAvailableModelsForProfiles@207`
- `extractSlashCommands@224`
- `isTransientStreamEventMessage@228`
- `getMessageCursor@244`
- `getMessageStableKey@255`
- `mergeMessages@271`
- `isRecord@287`
- `extractPlanSnapshotFromMessage@291`
- `deriveLatestPlanSnapshot@340`
- `trimMessagesToRecent@350`
- `appendMessagesToSession@370`
- `CODE_REFERENCE_DRAFT_SESSION_ID@63`
- `parsed@189`
- `enabledProfiles@201`
- `MAX_RENDERER_HISTORY_MESSAGES@238`
- `STREAM_MESSAGE_BATCH_DELAY_MS@240`
- `pendingStreamMessagesBySession@243`
- `seen@274`
- `key@277`
- `content@294`
- `toolName@300`
- `toolUseId@301`
- `turnId@302`
- `args@307`
- `args@323`
- `trimmedMessages@362`
- `slashCommands@375`
- `trimmed@379`
- `useAppStore@394`
- `sessionKey@455`
- `sessionKey@474`
- `sessionKey@491`
- `nextReferences@493`
- `nextBySession@494`
- `sessionKey@504`
- `nextBySession@507`

## 依赖输入

- `zustand`
- `../types`
- `../../shared/workflow-markdown`
- `../../shared/slash-commands`
- `../../shared/plan-progress`

## 对外暴露

- `PermissionRequest`
- `SessionView`
- `BrowserWorkbenchSessionState`
- `CODE_REFERENCE_DRAFT_SESSION_ID`
- `getCodeReferenceSessionKey`
- `CodeReferenceDraft`
- `MessageReferenceDraft`
- `FileReferenceDraft`
- `useAppStore`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import { create } from 'zustand';
import type {
  ApiConfigProfile,
  ApiConfigSettings,
  RuntimePermissionMode,
  RuntimeReasoningMode,
  SessionHistoryCursor,
  SessionWorkflowCatalog,
  ServerEvent,
  SessionStatus,
  StreamMessage,
} from "../types";
import {
  parseWorkflowMarkdown,
  type SessionWorkflowState,
  type WorkflowScope,
  type WorkflowSpecDocument,
} from "../../shared/workflow-markdown";
import { extractSlashCommandsFromMessages, mergeSlashCommandLists } from "../../shared/slash-commands";
import {
  normalizeTodoWriteArgs,
  normalizeUpdatePlanArgs,
  type SessionPlanSnapshot,
} from "../../shared/plan-progress";

export type PermissionRequest = {
  toolUseId: string;
  toolName: string;
  input: unknown;
};

export type SessionView = {
  id: string;
  title: string;
  status: SessionStatus;
  model?: string;
  cwd?: string;
  slashCommands?: string[];
  messages: StreamMessage[];
  permissionRequests: PermissionRequest[];
  lastPrompt?: string;
  workflowMarkdown?: string;
  workflowSourceLayer?: WorkflowScope;
  workflowSourcePath?: string;
  workflowState?: SessionWorkflowState;
  workflowSpec?: WorkflowSpecDocument;
  workflowError?: string;
  workflowCatalog?: SessionWorkflowCatalog;
  latestPlan?: SessionPlanSnapshot;
  archivedAt?: number;
  createdAt?: number;
  updatedAt?: number;
  hydrated: boolean;
  hasMoreHistory: boolean;
  historyCursor?: SessionHistoryCursor;
};

export type BrowserWorkbenchSessionState = {
  url?: string;
  hasBrowserTab: boolean;
  annotations: BrowserWorkbenchAnnotation[];
};

export const CODE_REFERENCE_DRAFT_SESSION_ID = "__draft__";

export function getCodeReferenceSessionKey(sessionId?: string | null) {
  return sessionId || CODE_REFERENCE_DRAFT_SESSION_ID;
}

export type CodeReferenceDraft = {
  id: string;
  kind: "selection" | "comment";
  filePath: string;
  fileName: string;
  language?: string;
  startLine: number;
  endLine: number;
  code: string;
  comment?: string;
  createdAt: number;
};

export type MessageReferenceDraft = {
  id: string;
  kind: "selection" | "message";
  sourceRole: "user" | "assistant" | "tool" | "system";
  sourceLabel: string;
  text: string;
  capturedAt?: number;
  createdAt: number;
};

export type FileReferenceDraft = {
  id: string;
  kind: "file" | "directory";
  path: string;
  name: string;
  label: string;
  workspaceRoot: string;
  createdAt: number;
};

interface AppState {
  sessions: Record<string, SessionView>;
  archivedSessions: Record<string, SessionView>;
  activeSessionId: string | null;
  prompt: string;
  browserAnnotations: BrowserWorkbenchAnnotation[];
  browserWorkbenchBySessionId: Record<string, BrowserWorkbenchSessionState>;
  codeReferencesBySessionId: Record<string, CodeReferenceDraft[]>;
  messageReferencesBySessionId: Record<string, MessageReferenceDraft[]>;
  fileReferencesBySessionId: Record<string, FileReferenceDraft[]>;
  cwd: string;
  apiConfigSettings: ApiConfigSettings;
  runtimeModel: string;
  reasoningMode: RuntimeReasoningMode;
  permissionMode: RuntimePermissionMode;
  pendingStart: boolean;
  globalError: string | null;
  sessionsLoaded: boolean;
  showStartModal: boolean;
  showSettingsModal: boolean;
  historyRequested: Set<string>;
  apiConfigChecked: boolean;
  availableAgents: Array<{ id: string; name: string; description?: string; scope: string }>;
  selectedAgentId: string;

  setPrompt: (prompt: string) => void;
  setBrowserAnnotations: (annotations: BrowserWorkbenchAnnotation[]) => void;
  clearBrowserAnnotations: () => void;
  setBrowserWorkbenchUrl: (sessionId: string, url: string) => void;
  setBrowserWorkbenchHasTab: (sessionId: string, hasBrowserTab: boolean) => void;
  setBrowserWorkbenchAnnotations: (sessionId: string, annotations: BrowserWorkbenchAnnotation[]) => void;
  addCodeReference: (
    sessionId: string | null | undefined,
    reference: Omit<CodeReferenceDraft, "id" | "createdAt"> & Partial<Pick<CodeReferenceDraft, "id" | "createdAt">>,
  ) => CodeReferenceDraft;
  updateCodeReference: (sessionId: string | null | undefined, id: string, patch: Partial<Pick<CodeReferenceDraft, "comment" | "kind">>) => void;
  removeCodeReference: (sessionId: string | null | und
... (truncated)
```
