# src/shared/workflow-markdown.ts

> 模块：`shared` · 语言：`typescript` · 行数：931

## 文件职责

解析和验证工作流 markdown 文档，构建工作流规格和会话状态

## 关键符号

- `WorkflowSpecDocument@0 - 工作流规格文档，包含 workflowId、name、scope、steps、sections(goal/rules/inputs/outputs)`
- `WorkflowStepSpec@0 - 工作流步骤规格：id、title、executor、intent、doneWhen、dependsOn、toolsHint`
- `SessionWorkflowState@0 - 会话级工作流状态：currentStepId、status、steps 数组及各自状态`
- `parseWorkflowMarkdown@0 - 解析 markdown 文档并提取 frontmatter 和 body sections`
- `createInitialSessionWorkflowState@0 - 从文档创建初始会话工作流状态`

## 对外暴露

- `WORKFLOW_SCOPE_VALUES`
- `WORKFLOW_MODE_VALUES`
- `WORKFLOW_ENTRY_VALUES`
- `WORKFLOW_EXECUTOR_VALUES`
- `WORKFLOW_INTENT_VALUES`
- `WORKFLOW_USER_ACTION_VALUES`
- `WORKFLOW_RUNTIME_FIELD_NAMES`
- `WorkflowScope`
- `WorkflowMode`
- `WorkflowEntry`
- `WorkflowExecutor`
- `WorkflowIntent`
- `WorkflowUserAction`
- `WorkflowRuntimeFieldName`
- `WorkflowStepSpec`
- `WorkflowSpecDocument`
- `SessionWorkflowState`
- `createInitialSessionWorkflowState`
- `WorkflowParseSeverity`
- `WorkflowParseIssue`
- `WorkflowMarkdownParseResult`
- `parseWorkflowMarkdown`
- `validateWorkflowMarkdown`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
export const WORKFLOW_SCOPE_VALUES = ["system", "user", "project", "session"] as const;
export const WORKFLOW_MODE_VALUES = ["single-thread"] as const;
export const WORKFLOW_ENTRY_VALUES = ["manual"] as const;
export const WORKFLOW_EXECUTOR_VALUES = ["primary-agent"] as const;
export const WORKFLOW_INTENT_VALUES = ["inspect", "implement", "verify", "deliver", "other"] as const;
export const WORKFLOW_USER_ACTION_VALUES = ["run", "skip", "edit", "retry"] as const;
export const WORKFLOW_RUNTIME_FIELD_NAMES = [
  "status",
  "current_step",
  "current_step_id",
  "last_run_at",
  "last_result",
  "last_result_summary",
  "failure_reason",
  "retry_count",
] as const;

export type WorkflowScope = (typeof WORKFLOW_SCOPE_VALUES)[number];
export type WorkflowMode = (typeof WORKFLOW_MODE_VALUES)[number];
export type WorkflowEntry = (typeof WORKFLOW_ENTRY_VALUES)[number];
export type WorkflowExecutor = (typeof WORKFLOW_EXECUTOR_VALUES)[number];
export type WorkflowIntent = (typeof WORKFLOW_INTENT_VALUES)[number];
export type WorkflowUserAction = (typeof WORKFLOW_USER_ACTION_VALUES)[number];
export type WorkflowRuntimeFieldName = (typeof WORKFLOW_RUNTIME_FIELD_NAMES)[number];

export type WorkflowStepSpec = {
  id: string;
  title: string;
  executor: WorkflowExecutor;
  intent: WorkflowIntent;
  doneWhen: string;
  userActions?: WorkflowUserAction[];
  dependsOn?: string[];
  toolsHint?: string[];
  notes?: string;
  body: string;
};

export type WorkflowSpecDocument = {
  workflowId: string;
  name: string;
  version: string;
  scope: WorkflowScope;
  mode: WorkflowMode;
  entry: WorkflowEntry;
  owner: string;
  description?: string;
  autoAdvance: boolean;
  autoBind: boolean;
  priority?: number;
  extends?: string;
  tags?: string[];
  triggers?: string[];
  matchTags?: string[];
  appliesToPaths?: string[];
  excludeTags?: string[];
  excludePaths?: string[];
  title: string;
  sections: {
    goal: string;
    scopeText?: string;
    rules: string;
    inputs?: string;
    outputs?: string;
  };
  steps: WorkflowStepSpec[];
  rawMarkdown: string;
};

export type SessionWorkflowState = {
  workflowId: string;
  sourceLayer: WorkflowScope;
  sourcePath?: string;
  currentStepId?: string;
  status: "idle" | "running" | "completed" | "failed";
  steps: Array<{
    stepId: string;
    status: "pending" | "running" | "completed" | "skipped" | "failed";
    lastRunAt?: number;
    lastResultSummary?: string;
    failureReason?: string;
  }>;
};

export function createInitialSessionWorkflowState(
  document: Pick<WorkflowSpecDocument, "workflowId" | "steps">,
  sourceLayer: WorkflowScope,
  sourcePath?: string,
): SessionWorkflowState {
  return {
    workflowId: document.workflowId,
    sourceLayer,
    sourcePath,
    currentStepId: document.steps[0]?.id,
    status: "idle",
    steps: document.steps.map((step) => ({
      stepId: step.id,
      status: "pending",
    })),
  };
}

export type WorkflowParseSeverity = "error" | "warning";

export type WorkflowParseIssue = {
  code: string;
  message: string;
  severity: WorkflowParseSeverity;
  line?: number;
  field?: string;
  stepId?: string;
};

export type WorkflowMarkdownParseResult = {
  ok: boolean;
  document: WorkflowSpecDocument | null;
  errors: WorkflowParseIssue[];
  warnings: WorkflowParseIssue[];
};

type ParsedFrontmatter = {
  data: Record<string, unknown>;
  body: string;
  frontmatterStartLine: number;
};

type ParsedStepDraft = {
  headingId: string;
  meta: Record<string, unknown>;
  body: string;
  line: number;
};

type ParsedBodySections = {
  title: string;
  sections: Map<string, { content: string; line: number }>;
};

export function parseWorkflowMarkdown(markdown: string): WorkflowMarkdownParseResult {
  const errors: WorkflowParseIssue[] = [];
  const warnings: WorkflowParseIssue[] = [];
  const frontmatter = extractFrontmatter(markdown, errors);
  if (!frontmatter) {
    return buildParseResult(null, errors, warnings);
  }

  rejectRuntimeFields(frontmatter.data, "frontmatter", frontmatter.frontmatterStartLine + 1, errors);
  const bodySections = parseBodySections(frontmatter.body, errors, warnings);
  if (!bodySections) {
    return buildParseResult(nu
... (truncated)
```
