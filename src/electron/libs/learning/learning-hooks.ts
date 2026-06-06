import { LearningStore } from "./learning-store.js";
import { app } from "electron";
import { join, basename } from "path";
import { existsSync } from "fs";
import type { SyncHookJSONOutput } from "@anthropic-ai/claude-agent-sdk";

let storeInstance: LearningStore | null = null;

function getLearningStore(): LearningStore | null {
  if (storeInstance) return storeInstance;
  try {
    const userDataPath = app.getPath("userData");
    const dbPath = join(userDataPath, "learning-store.db");
    storeInstance = new LearningStore(dbPath);
    return storeInstance;
  } catch {
    return null;
  }
}

// ─── Secret Scan Patterns ───────────────────────────────────────────
const SECRET_PATTERNS = [
  { name: "AWS Access Key", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "AWS Secret Key", re: /\b(?:aws_)?secret(?:_access)?_key\s*[=:]\s*["']?[A-Za-z0-9/+=]{40}["']?/i },
  { name: "GitHub Token", re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
  { name: "GitHub Fine-Grained Token", re: /\bgithub_pat_[A-Za-z0-9_]{82}\b/ },
  { name: "Anthropic API Key", re: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/ },
  { name: "OpenAI API Key", re: /\bsk-(?:proj-)?(?!ant-)[A-Za-z0-9_-]{20,}\b/ },
  { name: "Slack Token", re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { name: "Google API Key", re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: "Stripe Secret Key", re: /\bsk_live_[0-9a-zA-Z]{24,}\b/ },
  { name: "Private Key Block", re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/ },
  { name: "Generic Bearer Token", re: /\bBearer\s+[A-Za-z0-9_\-.=]{30,}/ },
  { name: "Generic Password Assignment", re: /\b(?:password|passwd|pwd)\s*[=:]\s*["'][^"'\s]{8,}["']/i },
  { name: "Generic Secret Assignment", re: /\b(?:api[-_]?key|api[-_]?secret|secret|token)\s*[=:]\s*["'][A-Za-z0-9_-]{20,}["']/i },
];

const SECRET_ALLOWLIST = [
  /example|placeholder|your[-_]?(?:api[-_]?)?key|xxx+|\*{4,}|<[A-Z_]+>/i,
  /process\.env\./,
  /os\.getenv|os\.environ/,
];

function scanForSecrets(content: string): { name: string; snippet: string; line: number } | null {
  if (!content) return null;
  for (const { name, re } of SECRET_PATTERNS) {
    const m = content.match(re);
    if (!m) continue;
    const snippet = m[0];
    const matchIndex = m.index ?? 0;
    const line = content.slice(0, matchIndex).split("\n").length;
    const lineEndIndex = content.indexOf("\n", matchIndex);
    const wholeLine = content.slice(
      content.lastIndexOf("\n", matchIndex - 1) + 1,
      lineEndIndex >= 0 ? lineEndIndex : content.length,
    );
    if (SECRET_ALLOWLIST.some(a => a.test(wholeLine))) continue;
    return { name, snippet: snippet.slice(0, 40), line };
  }
  return null;
}

// ─── Git Blast Radius ───────────────────────────────────────────────
const GIT_PREFIX = /\bgit(?:\s+(?:-[cC]\s+\S+|--\S+(?:=\S+)?|-[a-zA-Z]+))*\s+/;
function sub(pattern: RegExp): RegExp {
  return new RegExp(GIT_PREFIX.source + pattern.source);
}

const GIT_BLOCK = [
  { name: "force push (--force / -f)", re: sub(/push\s+(?:[^\s]+\s+)*(?:-f\b|--force\b)(?!-with-lease)/) },
  { name: "hard reset", re: sub(/reset\s+(?:[^\s]+\s+)*--hard\b/) },
  { name: "working-tree clean", re: sub(/clean\s+(?:[^\s]*f)/) },
  { name: "branch deletion (-D)", re: sub(/branch\s+(?:[^\s]+\s+)*-D\b/) },
  { name: "checkout discard (.)", re: sub(/checkout\s+(?:--\s+)?\.\s*$/) },
  { name: "restore discard (.)", re: sub(/restore\s+(?:[^\s]+\s+)*\.\s*$/) },
  { name: "stash drop/clear", re: sub(/stash\s+(?:drop|clear)\b/) },
  { name: "remote branch delete (--delete)", re: sub(/push\s+(?:[^\s]+\s+)*--delete\b/) },
];

// ─── Conventional Commit Validation ─────────────────────────────────
const COMMIT_TYPES = ["feat", "fix", "refactor", "test", "docs", "chore", "perf", "ci", "style", "build", "revert"];
const COMMIT_PATTERN = new RegExp(`^(${COMMIT_TYPES.join("|")})(\\([\\w\\-.,/ ]+\\))?!?: .+`);
const MAX_COMMIT_SUMMARY = 72;

function validateCommitMessage(command: string): { ok: boolean; reason?: string } {
  const shortFlag = command.match(/(?:^|\s)-m\s+(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|(\S+))/);
  const longFlag = command.match(/--message(?:=|\s+)(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|(\S+))/);
  const raw = shortFlag?.[1] || shortFlag?.[2] || shortFlag?.[3] ||
              longFlag?.[1] || longFlag?.[2] || longFlag?.[3];
  if (!raw) return { ok: true };
  const firstLine = raw.split("\n")[0].trim();
  if (!COMMIT_PATTERN.test(firstLine)) {
    return {
      ok: false,
      reason: `Commit message must follow conventional commits: <type>(<scope>): <summary>. Valid types: ${COMMIT_TYPES.join(", ")}.`,
    };
  }
  const summary = firstLine.split(":").slice(1).join(":").trim();
  if (summary.length > MAX_COMMIT_SUMMARY) {
    return { ok: false, reason: `Commit summary is ${summary.length} chars, must be <= ${MAX_COMMIT_SUMMARY}.` };
  }
  return { ok: true };
}

// ─── Correction Detection ───────────────────────────────────────────
const CORRECTION_PATTERNS = [
  /no,?\s*(that's|thats)?\s*(wrong|incorrect|not right)/i,
  /you\s*(should|shouldn't|need to|forgot)/i,
  /that's not what I (meant|asked|wanted)/i,
  /wrong file/i,
  /undo that/i,
  /revert/i,
  /don't do that/i,
];

const LEARN_TRIGGER_PATTERNS = [
  /remember (this|that)/i,
  /add (this|that) to (your )?rules/i,
  /don't (do|make) that (again|mistake)/i,
  /learn from this/i,
  /\[LEARN\]/i,
];

// ─── Learn Capture ──────────────────────────────────────────────────
// ─── Adaptive Quality Gate Threshold ────────────────────────────────
function getAdaptiveThreshold(store: LearningStore): { first: number; second: number; repeat: number } {
  try {
    const sessions = store.getRecentSessions(10);
    if (sessions.length < 3) return { first: 5, second: 10, repeat: 10 };
    const totalEdits = sessions.reduce((s, sess) => s + sess.edit_count, 0);
    const totalCorrections = sessions.reduce((s, sess) => s + sess.corrections_count, 0);
    const correctionRate = totalEdits > 0 ? totalCorrections / totalEdits : 0;
    if (correctionRate > 0.25) return { first: 3, second: 6, repeat: 6 };
    if (correctionRate > 0.15) return { first: 5, second: 10, repeat: 10 };
    if (correctionRate > 0.05) return { first: 8, second: 15, repeat: 15 };
    return { first: 10, second: 20, repeat: 20 };
  } catch {
    return { first: 5, second: 10, repeat: 10 };
  }
}

// ─── Hook Event Types ───────────────────────────────────────────────
type HookReturn = SyncHookJSONOutput;

// ─── Export Hook Factories ──────────────────────────────────────────
// Each factory returns a hook callback that can be attached to the appropriate event

/**
 * Learn-capture hook for Stop event.
 * Parses [LEARN] blocks from the AI response and saves to the learnings DB.
 */
export function createLearnCaptureHook() {
  return async (input: Record<string, unknown>): Promise<HookReturn> => {
    const lastMessage = typeof input.last_assistant_message === "string" ? input.last_assistant_message : "";
    if (!lastMessage) {
      return { continue: true };
    }

    const store = getLearningStore();
    if (!store) {
      return { continue: true };
    }

    const learnRegex = /\[LEARN\]\s*([\w][\w\s-]*?)\s*:\s*(.+?)(?:\nMistake:\s*(.+?))?(?:\nCorrection:\s*(.+?))?(?:\nWiki:\s*([A-Za-z0-9_-]+))?(?=\n\[LEARN\]|\n\n|$)/gim;
    let match;
    let count = 0;
    let lastIndex = -1;

    try {
      while ((match = learnRegex.exec(lastMessage)) !== null) {
        if (learnRegex.lastIndex === lastIndex) break;
        lastIndex = learnRegex.lastIndex;

        const projectDir = process.env.CLAUDE_PROJECT_DIR || "";
        store.addLearning({
          project: projectDir ? basename(projectDir) : null,
          category: match[1].trim(),
          rule: match[2].trim(),
          mistake: match[3]?.trim() || null,
          correction: match[4]?.trim() || null,
        });
        count++;
      }
    } finally {
      // keep store alive for reuse
    }

    if (count > 0) {
      console.error(`[tech-cc-hub] Auto-saved ${count} learning(s) to database`);
    }

    return { continue: true };
  };
}

/**
 * Correction detection hook for UserPromptSubmit.
 * Detects correction patterns and learn triggers, logs corrections.
 */
export function createCorrectionDetectionHook() {
  return async (input: Record<string, unknown>): Promise<HookReturn> => {
    const prompt = typeof input.prompt === "string" ? input.prompt.trim() : "";
    if (!prompt) {
      return { continue: true };
    }

    const hints: string[] = [];

    // Check for correction patterns
    const isCorrection = CORRECTION_PATTERNS.some(p => p.test(prompt));
    if (isCorrection) {
      hints.push("检测到纠正模式，请注意记录为规则");
    }

    // Check for learn triggers
    const isLearnTrigger = LEARN_TRIGGER_PATTERNS.some(p => p.test(prompt));
    if (isLearnTrigger) {
      hints.push("检测到学习触发，将自动捕获规则");
    }

    if (hints.length === 0) {
      return { continue: true };
    }

    return {
      continue: true,
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: hints.join("；"),
      },
    };
  };
}

/**
 * Quality gate hook for PreToolUse (Edit/Write).
 * Tracks edit count and reminds at adaptive thresholds.
 */
export function createQualityGateHook(sessionId: string) {
  return async (input: Record<string, unknown>): Promise<HookReturn> => {
    const toolName = typeof input.tool_name === "string" ? input.tool_name : "";
    if (toolName !== "Edit" && toolName !== "Write" && toolName !== "MultiEdit") {
      return { continue: true };
    }

    const store = getLearningStore();
    if (!store) {
      return { continue: true };
    }

    try {
      const session = store.getRecentSessions(1);
      const threshold = getAdaptiveThreshold(store);
      let count = 1;

      const sid = sessionId || "default";
      // Check if session exists, otherwise register it
      const existing = session.find(s => s.session_id === sid);
      if (existing) {
        store.updateSessionCounts(sid, 1, 0, 0);
        count = existing.edit_count + 1;
      } else {
        store.startSession(sid);
        store.updateSessionCounts(sid, 1, 0, 0);
      }

      const hints: string[] = [];
      if (count === threshold.first) {
        hints.push(`${count} edits — checkpoint for review. Consider: git diff --stat`);
      }
      if (count === threshold.second) {
        hints.push(`${count} edits — run quality gates: npm run lint && npm run typecheck && npm test --changed`);
      }
      if (count > threshold.second && count % threshold.repeat === 0) {
        hints.push(`${count} edits — quality gates due`);
      }

      if (hints.length === 0) {
        return { continue: true };
      }

      return {
        continue: true,
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          additionalContext: `[Quality] ${hints.join("; ")}`,
        },
      };
    } catch {
      return { continue: true };
    }
  };
}

/**
 * Correction tracking hook for UserPromptSubmit.
 * Tracks prompt count and correction count for quality gate adaptation.
 */
export function createCorrectionTrackingHook(sessionId: string) {
  return async (input: Record<string, unknown>): Promise<HookReturn> => {
    const prompt = typeof input.prompt === "string" ? input.prompt.trim() : "";
    if (!prompt) {
      return { continue: true };
    }

    const store = getLearningStore();
    if (!store) {
      return { continue: true };
    }

    try {
      const sid = sessionId || "default";
      const isCorrection = CORRECTION_PATTERNS.some(p => p.test(prompt));

      // Try to find existing session in recent
      const sessions = store.getRecentSessions(1);
      const existing = sessions.find(s => s.session_id === sid);
      if (existing) {
        store.updateSessionCounts(sid, 0, isCorrection ? 1 : 0, 1);
      } else {
        store.startSession(sid);
        store.updateSessionCounts(sid, 0, isCorrection ? 1 : 0, 1);
      }
    } catch {
      // DB not initialized, fall back
    }

    return { continue: true };
  };
}

/**
 * Secret scan hook for PreToolUse on Edit/Write.
 */
export function createSecretScanHook() {
  return async (input: Record<string, unknown>): Promise<HookReturn> => {
    const toolName = typeof input.tool_name === "string" ? input.tool_name : "";
    if (toolName !== "Edit" && toolName !== "Write") {
      return { continue: true };
    }

    const toolInput = (typeof input.tool_input === "object" && input.tool_input !== null
      ? input.tool_input
      : {}) as Record<string, unknown>;

    const filePath = typeof toolInput.file_path === "string" ? toolInput.file_path : "";
    const content = (typeof toolInput.content === "string" ? toolInput.content : "") ||
                    (typeof toolInput.new_string === "string" ? toolInput.new_string : "");

    // Block writing to secret-like paths
    if (/\.(env|pem|key)$|\/secrets?\//i.test(filePath)) {
      console.error(`[tech-cc-hub] secret-scan: refusing to write to secret-like path: ${filePath}`);
      return {
        continue: true,
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: `Refusing to write to secret-like path: ${filePath}`,
        },
      };
    }

    const hit = scanForSecrets(content);
    if (hit) {
      return {
        continue: true,
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: `Secret detected: ${hit.name} near line ${hit.line}: ${hit.snippet}... — remove or load from env.`,
        },
      };
    }

    return { continue: true };
  };
}

/**
 * Git blast radius check for PreToolUse on Bash.
 */
export function createGitBlastRadiusHook() {
  return async (input: Record<string, unknown>): Promise<HookReturn> => {
    const toolName = typeof input.tool_name === "string" ? input.tool_name : "";
    if (toolName !== "Bash") {
      return { continue: true };
    }

    const toolInput = (typeof input.tool_input === "object" && input.tool_input !== null
      ? input.tool_input
      : {}) as Record<string, unknown>;
    const command = typeof toolInput.command === "string" ? toolInput.command : "";
    if (!command || !/^(?:.*\s)?git\b/.test(command)) {
      return { continue: true };
    }

    // Redact URLs
    const redacted = command.replace(/(https?:\/\/)[^/@\s]+@/gi, "$1***@");

    for (const { name, re } of GIT_BLOCK) {
      if (re.test(command)) {
        console.error(`[tech-cc-hub] git-blast-radius: blocked "${name}". Command: ${redacted}`);
        return {
          continue: true,
          hookSpecificOutput: {
            hookEventName: "PreToolUse",
            permissionDecision: "deny",
            permissionDecisionReason: `Blocked dangerous git operation: ${name}. Command: ${redacted}`,
          },
        };
      }
    }

    return { continue: true };
  };
}

/**
 * Commit message validation for PreToolUse on Bash.
 */
export function createCommitValidateHook() {
  return async (input: Record<string, unknown>): Promise<HookReturn> => {
    const toolName = typeof input.tool_name === "string" ? input.tool_name : "";
    if (toolName !== "Bash") {
      return { continue: true };
    }

    const toolInput = (typeof input.tool_input === "object" && input.tool_input !== null
      ? input.tool_input
      : {}) as Record<string, unknown>;
    const command = typeof toolInput.command === "string" ? toolInput.command : "";

    if (!command || !/\bgit\s+(?:-[^\s]+\s+)*commit\b/.test(command)) {
      return { continue: true };
    }

    const result = validateCommitMessage(command);
    if (!result.ok) {
      return {
        continue: true,
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          additionalContext: `[Commit] ${result.reason}`,
        },
      };
    }

    return { continue: true };
  };
}

/**
 * Tool call telemetry hook for PreToolUse (any tool).
 */
export function createToolCallBudgetHook(sessionId?: string) {
  return async (input: Record<string, unknown>): Promise<HookReturn> => {
    const toolName = typeof input.tool_name === "string" ? input.tool_name : "";
    if (!toolName) {
      return { continue: true };
    }

    // Count is tracked in-memory for simplicity
    const store = getLearningStore();
    if (!store) {
      return { continue: true };
    }

    const SID = sessionId || process.env.CLAUDE_SESSION_ID || "default";
    try {
      const sessions = store.getRecentSessions(100);
      const existing = sessions.find(s => s.session_id === SID);
      if (!existing) {
        store.startSession(SID);
      }
      // Track PreToolUse calls for execution-efficiency telemetry only.
      store.updateSessionCounts(SID, 1, 0, 0);
      return { continue: true };
    } catch {
      return { continue: true };
    }
  };
}

/**
 * Drift detector for UserPromptSubmit.
 */
export function createDriftDetectorHook() {
  const intentState: { intent: string; editsSinceLastTouch: number } = {
    intent: "",
    editsSinceLastTouch: 0,
  };

  return async (input: Record<string, unknown>): Promise<HookReturn> => {
    const prompt = typeof input.prompt === "string" ? input.prompt.trim() : "";
    if (!prompt || prompt.length < 10) {
      return { continue: true };
    }

    const extractIntent = (text: string): string | null => {
      const firstSentence = text.split(/[.!?\n]/)[0].trim();
      return firstSentence.slice(0, 200);
    };

    const extractKeywords = (text: string): string[] => {
      const stopWords = new Set([
        "a", "an", "the", "is", "are", "was", "be", "been", "have", "has",
        "do", "does", "did", "will", "would", "could", "can", "to", "of",
        "in", "for", "on", "with", "at", "by", "from", "as", "and", "but",
        "or", "not", "so", "if", "then", "than", "too", "very", "just",
        "also", "that", "this", "it", "its", "my", "your", "me", "i", "we",
      ]);
      return text.toLowerCase().replace(/[^\w\s]/g, " ").split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
    };

    const isNewIntent = (text: string): boolean => {
      return [
        /^(now|next|also|okay|ok)\s+(let's|can you|please|i need)/i,
        /^(switch|move|pivot|change)\s+(to|focus)/i,
        /^(forget|skip|instead|actually)/i,
        /^new task/i,
      ].some(p => p.test(text.trim()));
    };

    if (!intentState.intent) {
      const intent = extractIntent(prompt);
      if (intent) {
        intentState.intent = intent;
        intentState.editsSinceLastTouch = 0;
      }
      return { continue: true };
    }

    intentState.editsSinceLastTouch++;

    const intentKeywords = extractKeywords(intentState.intent);
    const promptKeywords = extractKeywords(prompt);
    const overlap = intentKeywords.filter(k => promptKeywords.includes(k)).length;
    const relevance = intentKeywords.length > 0 ? overlap / intentKeywords.length : 1;

    if (intentState.editsSinceLastTouch >= 6 && relevance < 0.2) {
      intentState.editsSinceLastTouch = 0;
      return {
        continue: true,
        hookSpecificOutput: {
          hookEventName: "UserPromptSubmit",
          additionalContext: `[Drift] ${intentState.editsSinceLastTouch} edits since original goal. Original: "${intentState.intent}". Current work seems unrelated — refocus or intentional tangent?`,
        },
      };
    }

    if (isNewIntent(prompt)) {
      const newIntent = extractIntent(prompt);
      if (newIntent) {
        intentState.intent = newIntent;
        intentState.editsSinceLastTouch = 0;
      }
    }

    return { continue: true };
  };
}

/**
 * Read-before-write check hook for PreToolUse on Edit/Write.
 */
export function createReadBeforeWriteHook() {
  const readFiles = new Set<string>();

  return {
    preToolUse: async (input: Record<string, unknown>): Promise<HookReturn> => {
      const toolName = typeof input.tool_name === "string" ? input.tool_name : "";
      const toolInput = (typeof input.tool_input === "object" && input.tool_input !== null
        ? input.tool_input
        : {}) as Record<string, unknown>;

      if (toolName === "Read") {
        const filePath = typeof toolInput.file_path === "string" ? toolInput.file_path : "";
        if (filePath) {
          readFiles.add(filePath);
        }
        return { continue: true };
      }

      if (toolName === "Write" || toolName === "Edit" || toolName === "MultiEdit") {
        const filePath = typeof toolInput.file_path === "string" ? toolInput.file_path : "";
        if (!filePath) return { continue: true };

        // Skip new files that don't exist yet (Write to new file is fine)
        if (toolName === "Write" && !existsSync(filePath)) {
          return { continue: true };
        }

        if (!readFiles.has(filePath)) {
          return {
            continue: true,
            hookSpecificOutput: {
              hookEventName: "PreToolUse",
              additionalContext: `[ReadBeforeWrite] Warning: ${toolName} on ${basename(filePath)} without reading it first. Read the file before modifying.`,
            },
          };
        }
      }

      return { continue: true };
    },
  };
}

// ─── Public API for IPC ─────────────────────────────────────────────

export function getLearningStoreForIPC() {
  return getLearningStore();
}

export function disposeLearningStore() {
  if (storeInstance) {
    storeInstance.close();
    storeInstance = null;
  }
}
