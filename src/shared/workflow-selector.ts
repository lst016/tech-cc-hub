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
  const values = [context.cwd, ...(context.activePaths ?? [])];
  return uniqueValues(values.map(normalizePath).filter(Boolean));
}

function collectTriggerHits(prompt: string, triggers?: string[]): string[] {
  if (!prompt || !triggers?.length) return [];
  return uniqueValues(
    triggers
      .map((trigger) => trigger.trim())
      .filter(Boolean)
      .filter((trigger) => prompt.includes(normalizeText(trigger))),
  );
}

function collectTagHits(contextTags: Set<string>, tags?: string[]): string[] {
  if (!tags?.length || contextTags.size === 0) return [];
  return uniqueValues(tags.map(normalizeText).filter((tag) => tag && contextTags.has(tag)));
}

function collectPathHits(contextPaths: string[], patterns?: string[]): string[] {
  if (!patterns?.length || contextPaths.length === 0) return [];
  return uniqueValues(
    patterns.filter((pattern) => {
      const matcher = buildGlobMatcher(pattern);
      return contextPaths.some((path) => matcher.test(path));
    }),
  );
}

function buildGlobMatcher(pattern: string): RegExp {
  const normalized = normalizePath(pattern);
  const escaped = normalized.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
  const regexSource = escaped
    .replace(/\*\*/g, "__DOUBLE_STAR__")
    .replace(/\*/g, "[^/]*")
    .replace(/__DOUBLE_STAR__/g, ".*");
  return new RegExp(`(^|/)${regexSource}$`);
}

function normalizePath(value?: string): string {
  return (value ?? "").replace(/\\/g, "/").replace(/\/+/g, "/").toLowerCase();
}

function normalizeText(value?: string): string {
  return (value ?? "").trim().toLowerCase();
}

function uniqueValues(values: string[]): string[] {
  return Array.from(new Set(values));
}
