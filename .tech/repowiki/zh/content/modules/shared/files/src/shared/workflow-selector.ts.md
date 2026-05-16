# src/shared/workflow-selector.ts

> 模块：`shared` · 语言：`typescript` · 行数：194

## 文件职责

根据 prompt、上下文路径和标签匹配工作流文档，计算候选评分并支持自动绑定

## 关键符号

- `WorkflowSelectionContext@0 - 选择上下文：prompt、cwd、activePaths、tags、strictPathFiltering`
- `WorkflowSelectionResult@0 - 选择结果：candidates 数组、recommendedWorkflowId、autoSelectedWorkflowId`
- `selectWorkflowCandidates@0 - 核心入口，对文档列表评分排序并决定是否自动选择`
- `scoreWorkflowDocument@0 - 对单个文档评分，考虑 triggers、tags、paths 匹配和 exclude 过滤`

## 依赖输入

- `./workflow-markdown.js`

## 对外暴露

- `WorkflowSelectionContext`
- `WorkflowSelectionCandidate`
- `WorkflowSelectionResult`
- `selectWorkflowCandidates`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import type { WorkflowScope, WorkflowSpecDocument } from "./workflow-markdown.js";

export type WorkflowSelectionContext = {
  prompt?: string;
  cwd?: string;
  activePaths?: string[];
  tags?: string[];
  strictPathFiltering?: boolean;
};

export type WorkflowSelectionCandidate = {
  document: WorkflowSpecDocument;
  score: number;
  autoBindable: boolean;
  reasons: string[];
  matchedTriggers: string[];
  matchedTags: string[];
  matchedPaths: string[];
};

export type WorkflowSelectionResult = {
  candidates: WorkflowSelectionCandidate[];
  recommendedWorkflowId?: string;
  autoSelectedWorkflowId?: string;
};

const SCOPE_WEIGHTS: Record<WorkflowScope, number> = {
  system: 8,
  user: 12,
  project: 18,
  session: 24,
};

export function selectWorkflowCandidates(
  documents: WorkflowSpecDocument[],
  context: WorkflowSelectionContext,
): WorkflowSelectionResult {
  const normalizedPrompt = normalizeText(context.prompt);
  const normalizedTags = new Set((context.tags ?? []).map(normalizeText).filter(Boolean));
  const normalizedPaths = collectContextPaths(context);

  const candidates = documents
    .flatMap((document) => {
      const candidate = scoreWorkflowDocument(
        document,
        normalizedPrompt,
        normalizedTags,
        normalizedPaths,
        context.strictPathFiltering ?? false,
      );
      return candidate ? [candidate] : [];
    })
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return (right.document.priority ?? 0) - (left.document.priority ?? 0);
    });

  const recommendedWorkflowId = candidates[0]?.document.workflowId;
  const topCandidate = candidates[0];
  const secondCandidate = candidates[1];
  const explicitSignals =
    (topCandidate?.matchedTriggers.length ?? 0) +
    (topCandidate?.matchedTags.length ?? 0) +
    (topCandidate?.matchedPaths.length ?? 0);
  const scoreGap = topCandidate ? topCandidate.score - (secondCandidate?.score ?? 0) : 0;
  const autoSelectedWorkflowId =
    topCandidate &&
    topCandidate.autoBindable &&
    explicitSignals > 0 &&
    topCandidate.score >= 45 &&
    scoreGap >= 10
      ? topCandidate.document.workflowId
      : undefined;

  return {
    candidates,
    recommendedWorkflowId,
    autoSelectedWorkflowId,
  };
}

function scoreWorkflowDocument(
  document: WorkflowSpecDocument,
  normalizedPrompt: string,
  normalizedTags: Set<string>,
  normalizedPaths: string[],
  strictPathFiltering = false,
): WorkflowSelectionCandidate | null {
  const matchedExcludeTags = collectTagHits(normalizedTags, document.excludeTags);
  if (matchedExcludeTags.length > 0) {
    return null;
  }

  const matchedExcludePaths = collectPathHits(normalizedPaths, document.excludePaths);
  if (matchedExcludePaths.length > 0) {
    return null;
  }

  const matchedPaths = collectPathHits(normalizedPaths, document.appliesToPaths);
  if (strictPathFiltering && (document.appliesToPaths?.length ?? 0) > 0 && normalizedPaths.length > 0 && matchedPaths.length === 0) {
    return null;
  }

  const matchedTriggers = collectTriggerHits(normalizedPrompt, document.triggers);
  const matchedTags = [
    ...collectTagHits(normalizedTags, document.tags),
    ...collectTagHits(normalizedTags, document.matchTags),
  ];

  let score = SCOPE_WEIGHTS[document.scope] + Math.min(Math.max(document.priority ?? 0, 0), 100) / 5;
  const reasons: string[] = [`scope:${document.scope}`];

  if (matchedPaths.length > 0) {
    score += 24;
    reasons.push(`paths:${matchedPaths.length}`);
  }

  if (matchedTriggers.length > 0) {
    score += Math.min(24, matchedTriggers.length * 12);
    reasons.push(`triggers:${matchedTriggers.length}`);
  }

  if (matchedTags.length > 0) {
    score += Math.min(18, matchedTags.length * 6);
    reasons.push(`tags:${matchedTags.length}`);
  }

  if ((document.priority ?? 0) > 0) {
    reasons.push(`priority:${document.priority}`);
  }

  return {
    document,
    score,
    autoBindable: document.autoBind,
    reasons,
    matchedTriggers,
    matchedTags: uniqueValues(matchedTags),
    matchedPaths,
  };
}

function collectContextPaths(context: WorkflowSelectionContext): string[] {
  const values = [c
... (truncated)
```
