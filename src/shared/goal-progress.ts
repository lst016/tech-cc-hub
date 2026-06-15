export type SessionGoalStatus = "active" | "complete" | "blocked";

export type SessionGoalSource =
  | "slash_command"
  | "create_goal"
  | "update_goal"
  | "get_goal";

export type SessionGoalSnapshot = {
  sessionId: string;
  objective?: string;
  status: SessionGoalStatus;
  updatedAt: number;
  source: SessionGoalSource;
  turnId?: string;
  toolName?: string;
  toolUseId?: string;
  tokenBudget?: number;
  tokenUsage?: number;
  elapsedMs?: number;
};

type GoalToolName = "create_goal" | "update_goal" | "get_goal";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeGoalToolName(value: unknown): GoalToolName | null {
  if (typeof value !== "string") return null;
  const name = value.trim();
  if (name === "create_goal" || name.endsWith("__create_goal") || name.endsWith(":create_goal") || name.endsWith("/create_goal")) {
    return "create_goal";
  }
  if (name === "update_goal" || name.endsWith("__update_goal") || name.endsWith(":update_goal") || name.endsWith("/update_goal")) {
    return "update_goal";
  }
  if (name === "get_goal" || name.endsWith("__get_goal") || name.endsWith(":get_goal") || name.endsWith("/get_goal")) {
    return "get_goal";
  }
  return null;
}

function normalizeGoalStatus(value: unknown): SessionGoalStatus | null {
  if (value === "active" || value === "running" || value === "in_progress") return "active";
  if (value === "complete" || value === "completed" || value === "done" || value === "success") return "complete";
  if (value === "blocked" || value === "failed") return "blocked";
  return null;
}

function normalizeNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function extractSlashGoal(prompt: unknown): string | null {
  if (typeof prompt !== "string") return null;
  const match = prompt.match(/^\s*\/goal(?:\s+([\s\S]*))?$/i);
  if (!match) return null;
  const objective = match[1]?.trim();
  return objective || "";
}

function extractTextContent(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === "string") return item;
      if (isRecord(item) && typeof item.text === "string") return item.text;
      if (isRecord(item) && typeof item.content === "string") return item.content;
      return "";
    }).filter(Boolean).join("\n");
  }
  if (isRecord(value) && typeof value.text === "string") return value.text;
  return "";
}

function parseGoalPayloadFromText(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const candidates = [trimmed];
  const objectMatch = trimmed.match(/\{[\s\S]*\}/);
  if (objectMatch) candidates.push(objectMatch[0]);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (isRecord(parsed)) return parsed;
    } catch {
      // Keep trying looser candidates.
    }
  }

  return null;
}

function mergeGoalSnapshot(
  previous: SessionGoalSnapshot | undefined,
  patch: Partial<SessionGoalSnapshot> & Pick<SessionGoalSnapshot, "sessionId" | "updatedAt" | "source">,
): SessionGoalSnapshot {
  return {
    sessionId: patch.sessionId,
    objective: patch.objective ?? previous?.objective,
    status: patch.status ?? previous?.status ?? "active",
    updatedAt: patch.updatedAt,
    source: patch.source,
    turnId: patch.turnId ?? previous?.turnId,
    toolName: patch.toolName ?? previous?.toolName,
    toolUseId: patch.toolUseId ?? previous?.toolUseId,
    tokenBudget: patch.tokenBudget ?? previous?.tokenBudget,
    tokenUsage: patch.tokenUsage ?? previous?.tokenUsage,
    elapsedMs: patch.elapsedMs ?? previous?.elapsedMs,
  };
}

function snapshotFromGoalPayload(
  sessionId: string,
  payload: Record<string, unknown>,
  updatedAt: number,
  source: SessionGoalSource,
  previous?: SessionGoalSnapshot,
): SessionGoalSnapshot {
  return mergeGoalSnapshot(previous, {
    sessionId,
    updatedAt,
    source,
    objective: firstString(payload.objective, payload.goal, payload.current_goal),
    status: normalizeGoalStatus(payload.status) ?? undefined,
    tokenBudget: normalizeNumber(payload.token_budget ?? payload.tokenBudget),
    tokenUsage: normalizeNumber(payload.token_usage ?? payload.tokenUsage ?? payload.tokens_used ?? payload.tokensUsed),
    elapsedMs: normalizeNumber(payload.elapsed_ms ?? payload.elapsedMs),
  });
}

export function deriveLatestGoalSnapshot(
  sessionId: string,
  messages: unknown[],
  fallback?: SessionGoalSnapshot,
): SessionGoalSnapshot | undefined {
  let latest = fallback;
  const goalToolUses = new Map<string, GoalToolName>();

  for (const message of messages) {
    if (!isRecord(message)) continue;
    const updatedAt = normalizeNumber(message.capturedAt) ?? Date.now();
    const turnId = typeof message.uuid === "string" ? message.uuid : undefined;

    if (message.type === "user_prompt") {
      const objective = extractSlashGoal(message.prompt);
      if (objective !== null) {
        latest = mergeGoalSnapshot(latest, {
          sessionId,
          updatedAt,
          source: "slash_command",
          objective: objective || undefined,
          status: "active",
          turnId,
        });
      }
      continue;
    }

    if (message.type === "assistant" && isRecord(message.message)) {
      const content = Array.isArray(message.message.content) ? message.message.content : [];
      for (const item of content) {
        if (!isRecord(item) || item.type !== "tool_use") continue;
        const toolName = normalizeGoalToolName(item.name);
        if (!toolName) continue;

        const toolUseId = typeof item.id === "string" ? item.id : undefined;
        if (toolUseId) goalToolUses.set(toolUseId, toolName);

        const input = isRecord(item.input) ? item.input : {};
        if (toolName === "create_goal") {
          latest = snapshotFromGoalPayload(sessionId, input, updatedAt, "create_goal", latest);
        } else if (toolName === "update_goal") {
          latest = mergeGoalSnapshot(latest, {
            sessionId,
            updatedAt,
            source: "update_goal",
            status: normalizeGoalStatus(input.status) ?? latest?.status ?? "active",
            turnId,
            toolName: typeof item.name === "string" ? item.name : toolName,
            toolUseId,
          });
        }
      }
      continue;
    }

    if (message.type === "user" && isRecord(message.message)) {
      const content = Array.isArray(message.message.content) ? message.message.content : [];
      for (const item of content) {
        if (!isRecord(item) || item.type !== "tool_result") continue;
        const toolUseId = typeof item.tool_use_id === "string" ? item.tool_use_id : "";
        const goalToolName = goalToolUses.get(toolUseId);
        if (goalToolName !== "get_goal" && goalToolName !== "update_goal") continue;

        const payload = parseGoalPayloadFromText(extractTextContent(item.content));
        if (!payload) continue;
        latest = snapshotFromGoalPayload(sessionId, payload, updatedAt, goalToolName, latest);
      }
    }
  }

  return latest;
}
