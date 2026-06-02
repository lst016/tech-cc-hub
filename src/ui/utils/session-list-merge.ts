import type { SessionInfo } from "../types.js";
import {
  parseWorkflowMarkdown,
  type SessionWorkflowState,
  type WorkflowScope,
  type WorkflowSpecDocument,
} from "../../shared/workflow-markdown.js";

export type WorkflowViewFields = {
  workflowMarkdown?: string;
  workflowState?: SessionWorkflowState;
  workflowSourceLayer?: WorkflowScope;
  workflowSourcePath?: string;
  workflowSpec?: WorkflowSpecDocument;
  workflowError?: string;
};

export type SessionListMergeTarget = WorkflowViewFields & {
  id: string;
  title: string;
  status: SessionInfo["status"];
  model?: SessionInfo["model"];
  executionMode?: SessionInfo["executionMode"];
  reasoningMode?: SessionInfo["reasoningMode"];
  permissionMode?: SessionInfo["permissionMode"];
  cwd?: string;
  slashCommands?: string[];
  archivedAt?: number;
  createdAt?: number;
  updatedAt?: number;
};

export function hydrateWorkflowView(
  markdown?: string,
  workflowState?: SessionWorkflowState,
  workflowSourceLayer?: WorkflowScope,
  workflowSourcePath?: string,
  workflowError?: string,
): WorkflowViewFields {
  const parsed = markdown ? parseWorkflowMarkdown(markdown) : null;
  return {
    workflowMarkdown: markdown,
    workflowState,
    workflowSourceLayer,
    workflowSourcePath,
    workflowSpec: parsed?.ok ? parsed.document ?? undefined : undefined,
    workflowError: workflowError ?? (parsed && !parsed.ok ? parsed.errors.map((item) => item.message).join("；") : undefined),
  };
}

function hasWorkflowPayload(session: SessionInfo): boolean {
  return (
    session.workflowMarkdown !== undefined ||
    session.workflowState !== undefined ||
    session.workflowSourceLayer !== undefined ||
    session.workflowSourcePath !== undefined ||
    session.workflowError !== undefined
  );
}

function preserveWorkflowView(existing: WorkflowViewFields): WorkflowViewFields {
  return {
    workflowMarkdown: existing.workflowMarkdown,
    workflowState: existing.workflowState,
    workflowSourceLayer: existing.workflowSourceLayer,
    workflowSourcePath: existing.workflowSourcePath,
    workflowSpec: existing.workflowSpec,
    workflowError: existing.workflowError,
  };
}

export function mergeSessionListSession<T extends SessionListMergeTarget>(
  existing: T,
  session: SessionInfo,
): T {
  const workflowView = hasWorkflowPayload(session)
    ? hydrateWorkflowView(
        session.workflowMarkdown,
        session.workflowState,
        session.workflowSourceLayer,
        session.workflowSourcePath,
        session.workflowError,
      )
    : preserveWorkflowView(existing);

  return {
    ...existing,
    status: session.status,
    title: session.title,
    model: session.model,
    executionMode: session.executionMode,
    reasoningMode: session.reasoningMode,
    permissionMode: session.permissionMode,
    cwd: session.cwd,
    slashCommands: session.slashCommands ?? existing.slashCommands,
    ...workflowView,
    archivedAt: session.archivedAt,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}
