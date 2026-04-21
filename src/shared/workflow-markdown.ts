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
    return buildParseResult(null, errors, warnings);
  }

  const goal = getRequiredSection(bodySections.sections, "目标", errors);
  const rules = getRequiredSection(bodySections.sections, "使用规则", errors);
  const stepsSection = getRequiredSection(bodySections.sections, "步骤", errors);

  if (!goal || !rules || !stepsSection) {
    return buildParseResult(null, errors, warnings);
  }

  const parsedSteps = parseStepsSection(stepsSection.content, stepsSection.line, errors);
  const document = buildWorkflowDocument({
    markdown,
    frontmatter: frontmatter.data,
    bodySections,
    goal,
    rules,
    parsedSteps,
    errors,
  });

  return buildParseResult(document, errors, warnings);
}

export function validateWorkflowMarkdown(markdown: string): WorkflowMarkdownParseResult {
  return parseWorkflowMarkdown(markdown);
}

function buildParseResult(
  document: WorkflowSpecDocument | null,
  errors: WorkflowParseIssue[],
  warnings: WorkflowParseIssue[],
): WorkflowMarkdownParseResult {
  return {
    ok: errors.length === 0 && document !== null,
    document: errors.length === 0 ? document : null,
    errors,
    warnings,
  };
}

function extractFrontmatter(markdown: string, errors: WorkflowParseIssue[]): ParsedFrontmatter | null {
  const normalized = markdown.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");

  if (lines[0]?.trim() !== "---") {
    errors.push({
      code: "missing_frontmatter",
      message: "工作流 Markdown 必须以 YAML frontmatter 开头",
      severity: "error",
      line: 1,
    });
    return null;
  }

  let closingIndex = -1;
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index].trim() === "---") {
      closingIndex = index;
      break;
    }
  }

  if (closingIndex === -1) {
    errors.push({
      code: "unterminated_frontmatter",
      message: "YAML frontmatter 缺少结束分隔符 ---",
      severity: "error",
      line: 1,
    });
    return null;
  }

  const frontmatterText = lines.slice(1, closingIndex).join("\n");
  const parsed = parseSimpleYamlRecord(frontmatterText, 2, errors);
  return {
    data: parsed,
    body: lines.slice(closingIndex + 1).join("\n"),
    frontmatterStartLine: 1,
  };
}

function parseBodySections(
  markdownBody: string,
  errors: WorkflowParseIssue[],
  warnings: WorkflowParseIssue[],
): ParsedBodySections | null {
  const lines = markdownBody.replace(/\r\n/g, "\n").split("\n");
  let title = "";
  let titleLine = -1;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const headingMatch = line.match(/^#\s+(.+?)\s*$/);
    if (headingMatch) {
      title = headingMatch[1].trim();
      titleLine = index + 1;
      break;
    }
    if (line.trim().length > 0) {
      warnings.push({
        code: "content_before_title",
        message: "一级标题前存在额外内容，解析时将忽略",
        severity: "warning",
        line: index + 1,
      });
      break;
    }
  }

  if (!title) {
    errors.push({
      code: "missing_title",
      message: "工作流 Markdown 必须包含一级标题",
      severity: "error",
    });
    return null;
  }

  const sections = new Map<string, { content: string; line: number }>();
  let currentSectionTitle: string | null = null;
  let currentSectionStartLine = -1;
  let currentSectionLines: string[] = [];

  const flushCurrentSection = () => {
    if (!currentSectionTitle) return;
    sections.set(currentSectionTitle, {
      content: trimMarkdownBlock(currentSectionLines.join("\n")),
      line: currentSectionStartLine,
    });
  };

  for (let index = titleLine; index < lines.length; index += 1) {
    const line = lines[index];
    const sectionHeadingMatch = line.match(/^##\s+(.+?)\s*$/);
    if (sectionHeadingMatch) {
      flushCurrentSection();
      currentSectionTitle = sectionHeadingMatch[1].trim();
      currentSectionStartLine = index + 1;
      currentSectionLines = [];
      continue;
    }

    if (!currentSectionTitle) {
      if (line.trim().length > 0) {
        warnings.push({
          code: "content_between_title_and_sections",
          message: "一级标题与固定章节之间存在额外内容，解析时将忽略",
          severity: "warning",
          line: index + 1,
        });
      }
      continue;
    }

    currentSectionLines.push(line);
  }

  flushCurrentSection();

  return {
    title,
    sections,
  };
}

function getRequiredSection(
  sections: Map<string, { content: string; line: number }>,
  title: string,
  errors: WorkflowParseIssue[],
): { content: string; line: number } | null {
  const section = sections.get(title);
  if (!section) {
    errors.push({
      code: "missing_required_section",
      message: `缺少必填章节「${title}」`,
      severity: "error",
    });
    return null;
  }
  return section;
}

function parseStepsSection(
  sectionContent: string,
  sectionLine: number,
  errors: WorkflowParseIssue[],
): ParsedStepDraft[] {
  const lines = sectionContent.split("\n");
  const parsedSteps: ParsedStepDraft[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const headingMatch = lines[index].match(/^###\s+(STEP-[A-Za-z0-9_-]+)\s*$/);
    if (!headingMatch) continue;

    const headingId = headingMatch[1];
    const headingLine = sectionLine + index + 1;
    let cursor = index + 1;

    while (cursor < lines.length && lines[cursor].trim().length === 0) {
      cursor += 1;
    }

    if (!/^```ya?ml\s*$/.test(lines[cursor] ?? "")) {
      errors.push({
        code: "missing_step_yaml_block",
        message: `步骤 ${headingId} 缺少紧随其后的 yaml 代码块`,
        severity: "error",
        line: headingLine,
        stepId: headingId,
      });
      continue;
    }

    const yamlStart = cursor + 1;
    cursor += 1;
    const yamlLines: string[] = [];
    while (cursor < lines.length && !/^```\s*$/.test(lines[cursor] ?? "")) {
      yamlLines.push(lines[cursor]);
      cursor += 1;
    }

    if (cursor >= lines.length) {
      errors.push({
        code: "unterminated_step_yaml_block",
        message: `步骤 ${headingId} 的 yaml 代码块缺少结束标记`,
        severity: "error",
        line: headingLine,
        stepId: headingId,
      });
      continue;
    }

    const meta = parseSimpleYamlRecord(yamlLines.join("\n"), sectionLine + yamlStart + 1, errors, headingId);
    rejectRuntimeFields(meta, "step", headingLine, errors, headingId);
    const bodyLines: string[] = [];
    cursor += 1;

    while (cursor < lines.length && !/^###\s+STEP-[A-Za-z0-9_-]+\s*$/.test(lines[cursor] ?? "")) {
      bodyLines.push(lines[cursor]);
      cursor += 1;
    }

    parsedSteps.push({
      headingId,
      meta,
      body: trimMarkdownBlock(bodyLines.join("\n")),
      line: headingLine,
    });

    index = cursor - 1;
  }

  if (parsedSteps.length === 0) {
    errors.push({
      code: "missing_steps",
      message: "工作流必须至少包含一个步骤块",
      severity: "error",
      line: sectionLine,
    });
  }

  return parsedSteps;
}

function buildWorkflowDocument(input: {
  markdown: string;
  frontmatter: Record<string, unknown>;
  bodySections: ParsedBodySections;
  goal: { content: string; line: number };
  rules: { content: string; line: number };
  parsedSteps: ParsedStepDraft[];
  errors: WorkflowParseIssue[];
}): WorkflowSpecDocument | null {
  const workflowId = readRequiredString(input.frontmatter, "workflow_id", input.errors);
  const name = readRequiredString(input.frontmatter, "name", input.errors);
  const version = readRequiredString(input.frontmatter, "version", input.errors);
  const owner = readRequiredString(input.frontmatter, "owner", input.errors);
  const scope = readRequiredEnum(input.frontmatter, "scope", WORKFLOW_SCOPE_VALUES, input.errors);
  const mode = readRequiredEnum(input.frontmatter, "mode", WORKFLOW_MODE_VALUES, input.errors);
  const entry = readRequiredEnum(input.frontmatter, "entry", WORKFLOW_ENTRY_VALUES, input.errors);
  const autoAdvance = readBooleanWithDefault(input.frontmatter, "auto_advance", false, input.errors);
  const autoBind = readBooleanWithDefault(input.frontmatter, "auto_bind", false, input.errors);
  const priority = readOptionalNumber(input.frontmatter, "priority", input.errors);
  const description = readOptionalString(input.frontmatter, "description", input.errors);
  const extendsValue = readOptionalString(input.frontmatter, "extends", input.errors);
  const tags = readOptionalStringArray(input.frontmatter, "tags", input.errors);
  const triggers = readOptionalStringArray(input.frontmatter, "triggers", input.errors);
  const matchTags = readOptionalStringArray(input.frontmatter, "match_tags", input.errors);
  const appliesToPaths = readOptionalStringArray(input.frontmatter, "applies_to_paths", input.errors);
  const excludeTags = readOptionalStringArray(input.frontmatter, "exclude_tags", input.errors);
  const excludePaths = readOptionalStringArray(input.frontmatter, "exclude_paths", input.errors);
  const scopeText = readSectionContent(input.bodySections.sections, "适用范围");
  const inputs = readSectionContent(input.bodySections.sections, "输入上下文");
  const outputs = readSectionContent(input.bodySections.sections, "输出产物");
  const steps = buildWorkflowSteps(input.parsedSteps, input.errors);

  if (!workflowId || !name || !version || !owner || !scope || !mode || !entry || steps.length === 0) {
    return null;
  }

  validateDependsOn(steps, input.errors);

  if (input.errors.length > 0) {
    return null;
  }

  return {
    workflowId,
    name,
    version,
    scope,
    mode,
    entry,
    owner,
    description: description ?? undefined,
    autoAdvance,
    autoBind,
    priority: priority ?? undefined,
    extends: extendsValue ?? undefined,
    tags: tags ?? undefined,
    triggers: triggers ?? undefined,
    matchTags: matchTags ?? undefined,
    appliesToPaths: appliesToPaths ?? undefined,
    excludeTags: excludeTags ?? undefined,
    excludePaths: excludePaths ?? undefined,
    title: input.bodySections.title,
    sections: {
      goal: input.goal.content,
      scopeText: scopeText ?? undefined,
      rules: input.rules.content,
      inputs: inputs ?? undefined,
      outputs: outputs ?? undefined,
    },
    steps,
    rawMarkdown: input.markdown,
  };
}

function buildWorkflowSteps(
  parsedSteps: ParsedStepDraft[],
  errors: WorkflowParseIssue[],
): WorkflowStepSpec[] {
  const seenIds = new Set<string>();
  const steps: WorkflowStepSpec[] = [];

  for (const parsedStep of parsedSteps) {
    const id = readRequiredString(parsedStep.meta, "id", errors, parsedStep.line, parsedStep.headingId);
    const title = readRequiredString(parsedStep.meta, "title", errors, parsedStep.line, parsedStep.headingId);
    const executor = readRequiredEnum(
      parsedStep.meta,
      "executor",
      WORKFLOW_EXECUTOR_VALUES,
      errors,
      parsedStep.line,
      parsedStep.headingId,
    );
    const intent = readRequiredEnum(
      parsedStep.meta,
      "intent",
      WORKFLOW_INTENT_VALUES,
      errors,
      parsedStep.line,
      parsedStep.headingId,
    );
    const doneWhen = readRequiredString(parsedStep.meta, "done_when", errors, parsedStep.line, parsedStep.headingId);
    const userActions = readOptionalEnumArray(
      parsedStep.meta,
      "user_actions",
      WORKFLOW_USER_ACTION_VALUES,
      errors,
      parsedStep.line,
      parsedStep.headingId,
    );
    const dependsOn = readOptionalStringArray(parsedStep.meta, "depends_on", errors, parsedStep.line, parsedStep.headingId);
    const toolsHint = readOptionalStringArray(parsedStep.meta, "tools_hint", errors, parsedStep.line, parsedStep.headingId);
    const notes = readOptionalString(parsedStep.meta, "notes", errors, parsedStep.line, parsedStep.headingId);

    if (!id || !title || !executor || !intent || !doneWhen) {
      continue;
    }

    if (!/^STEP-[A-Za-z0-9_-]+$/.test(id)) {
      errors.push({
        code: "invalid_step_id_format",
        message: `步骤 ID "${id}" 不合法，必须符合 STEP-* 格式`,
        severity: "error",
        line: parsedStep.line,
        field: "id",
        stepId: parsedStep.headingId,
      });
      continue;
    }

    if (id !== parsedStep.headingId) {
      errors.push({
        code: "step_heading_id_mismatch",
        message: `步骤标题 ${parsedStep.headingId} 与 yaml id ${id} 不一致`,
        severity: "error",
        line: parsedStep.line,
        field: "id",
        stepId: parsedStep.headingId,
      });
      continue;
    }

    if (seenIds.has(id)) {
      errors.push({
        code: "duplicate_step_id",
        message: `步骤 ID "${id}" 重复`,
        severity: "error",
        line: parsedStep.line,
        field: "id",
        stepId: id,
      });
      continue;
    }
    seenIds.add(id);

    steps.push({
      id,
      title,
      executor,
      intent,
      doneWhen,
      userActions: userActions ?? undefined,
      dependsOn: dependsOn ?? undefined,
      toolsHint: toolsHint ?? undefined,
      notes: notes ?? undefined,
      body: parsedStep.body,
    });
  }

  return steps;
}

function validateDependsOn(steps: WorkflowStepSpec[], errors: WorkflowParseIssue[]): void {
  const existingIds = new Set(steps.map((step) => step.id));

  for (const step of steps) {
    for (const dependsOnId of step.dependsOn ?? []) {
      if (!existingIds.has(dependsOnId)) {
        errors.push({
          code: "unknown_step_dependency",
          message: `步骤 ${step.id} 依赖了不存在的步骤 ${dependsOnId}`,
          severity: "error",
          field: "depends_on",
          stepId: step.id,
        });
      }
    }
  }
}

function rejectRuntimeFields(
  record: Record<string, unknown>,
  scope: "frontmatter" | "step",
  line: number,
  errors: WorkflowParseIssue[],
  stepId?: string,
): void {
  for (const fieldName of WORKFLOW_RUNTIME_FIELD_NAMES) {
    if (!(fieldName in record)) continue;
    errors.push({
      code: "runtime_field_in_source",
      message: `${scope === "frontmatter" ? "frontmatter" : "步骤元信息"} 中不允许出现运行时字段 "${fieldName}"`,
      severity: "error",
      line,
      field: fieldName,
      stepId,
    });
  }
}

function readRequiredString(
  record: Record<string, unknown>,
  field: string,
  errors: WorkflowParseIssue[],
  line?: number,
  stepId?: string,
): string | null {
  const value = record[field];
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push({
      code: "missing_required_field",
      message: `缺少必填字段 "${field}"`,
      severity: "error",
      field,
      line,
      stepId,
    });
    return null;
  }
  return value.trim();
}

function readOptionalString(
  record: Record<string, unknown>,
  field: string,
  errors: WorkflowParseIssue[],
  line?: number,
  stepId?: string,
): string | null {
  const value = record[field];
  if (value === undefined) return null;
  if (typeof value !== "string") {
    errors.push({
      code: "invalid_field_type",
      message: `字段 "${field}" 必须是字符串`,
      severity: "error",
      field,
      line,
      stepId,
    });
    return null;
  }
  return value.trim();
}

function readBooleanWithDefault(
  record: Record<string, unknown>,
  field: string,
  fallback: boolean,
  errors: WorkflowParseIssue[],
  line?: number,
): boolean {
  const value = record[field];
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") {
    errors.push({
      code: "invalid_field_type",
      message: `字段 "${field}" 必须是布尔值`,
      severity: "error",
      field,
      line,
    });
    return fallback;
  }
  return value;
}

function readOptionalNumber(
  record: Record<string, unknown>,
  field: string,
  errors: WorkflowParseIssue[],
  line?: number,
  stepId?: string,
): number | null {
  const value = record[field];
  if (value === undefined) return null;
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
    errors.push({
      code: "invalid_field_type",
      message: `Field "${field}" must be a number`,
      severity: "error",
      field,
      line,
      stepId,
    });
    return null;
  }
  return value;
}

function readRequiredEnum<TValue extends string>(
  record: Record<string, unknown>,
  field: string,
  allowedValues: readonly TValue[],
  errors: WorkflowParseIssue[],
  line?: number,
  stepId?: string,
): TValue | null {
  const value = readRequiredString(record, field, errors, line, stepId);
  if (!value) return null;
  if (!allowedValues.includes(value as TValue)) {
    errors.push({
      code: "invalid_enum_value",
      message: `字段 "${field}" 必须是 ${allowedValues.join(" / ")} 之一`,
      severity: "error",
      field,
      line,
      stepId,
    });
    return null;
  }
  return value as TValue;
}

function readOptionalStringArray(
  record: Record<string, unknown>,
  field: string,
  errors: WorkflowParseIssue[],
  line?: number,
  stepId?: string,
): string[] | null {
  const value = record[field];
  if (value === undefined) return null;
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    errors.push({
      code: "invalid_field_type",
      message: `字段 "${field}" 必须是字符串数组`,
      severity: "error",
      field,
      line,
      stepId,
    });
    return null;
  }
  return value.map((item) => item.trim()).filter(Boolean);
}

function readOptionalEnumArray<TValue extends string>(
  record: Record<string, unknown>,
  field: string,
  allowedValues: readonly TValue[],
  errors: WorkflowParseIssue[],
  line?: number,
  stepId?: string,
): TValue[] | null {
  const values = readOptionalStringArray(record, field, errors, line, stepId);
  if (!values) return null;

  const invalidValue = values.find((value) => !allowedValues.includes(value as TValue));
  if (invalidValue) {
    errors.push({
      code: "invalid_enum_value",
      message: `字段 "${field}" 只能包含 ${allowedValues.join(" / ")}，但收到 "${invalidValue}"`,
      severity: "error",
      field,
      line,
      stepId,
    });
    return null;
  }

  return values as TValue[];
}

function readSectionContent(
  sections: Map<string, { content: string; line: number }>,
  title: string,
): string | null {
  return sections.get(title)?.content ?? null;
}

function parseSimpleYamlRecord(
  yamlText: string,
  baseLine: number,
  errors: WorkflowParseIssue[],
  stepId?: string,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = yamlText.split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const keyValueMatch = rawLine.match(/^([A-Za-z0-9_]+):(?:\s+(.*))?$/);
    if (!keyValueMatch) {
      errors.push({
        code: "invalid_yaml_line",
        message: `无法解析 YAML 行：${trimmed}`,
        severity: "error",
        line: baseLine + index,
        stepId,
      });
      continue;
    }

    const [, key, inlineValue = ""] = keyValueMatch;
    if (!inlineValue.trim()) {
      const listItems: string[] = [];
      let cursor = index + 1;
      while (cursor < lines.length) {
        const nestedLine = lines[cursor];
        const listMatch = nestedLine.match(/^\s*-\s+(.*)$/);
        if (!listMatch) break;
        const parsedItem = parseYamlScalar(listMatch[1].trim());
        if (typeof parsedItem !== "string") {
          errors.push({
            code: "invalid_yaml_array_value",
            message: `字段 "${key}" 的数组项必须是字符串`,
            severity: "error",
            line: baseLine + cursor,
            field: key,
            stepId,
          });
        } else {
          listItems.push(parsedItem);
        }
        cursor += 1;
      }

      if (listItems.length === 0) {
        result[key] = "";
      } else {
        result[key] = listItems;
        index = cursor - 1;
      }
      continue;
    }

    result[key] = parseYamlScalar(inlineValue.trim());
  }

  return result;
}

function parseYamlScalar(value: string): unknown {
  const normalized = value.trim();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  if (/^-?\d+(?:\.\d+)?$/.test(normalized)) return Number(normalized);

  if (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    return normalized.slice(1, -1);
  }

  if (normalized.startsWith("[") && normalized.endsWith("]")) {
    const inner = normalized.slice(1, -1).trim();
    if (!inner) return [];
    return splitInlineArray(inner).map((item) => {
      const parsed = parseYamlScalar(item);
      return typeof parsed === "string" ? parsed : String(parsed);
    });
  }

  return normalized;
}

function splitInlineArray(value: string): string[] {
  const items: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if ((char === '"' || char === "'") && quote === null) {
      quote = char;
      current += char;
      continue;
    }

    if (quote !== null && char === quote) {
      quote = null;
      current += char;
      continue;
    }

    if (char === "," && quote === null) {
      items.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    items.push(current.trim());
  }

  return items;
}

function trimMarkdownBlock(value: string): string {
  const lines = value.split("\n");
  while (lines.length > 0 && lines[0].trim().length === 0) {
    lines.shift();
  }
  while (lines.length > 0 && lines[lines.length - 1].trim().length === 0) {
    lines.pop();
  }
  return lines.join("\n");
}
