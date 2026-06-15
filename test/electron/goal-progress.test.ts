import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { deriveLatestGoalSnapshot } from "../../src/shared/goal-progress.js";

describe("goal progress", () => {
  it("extracts an active goal from the /goal slash command", () => {
    const snapshot = deriveLatestGoalSnapshot("session-1", [
      {
        type: "user_prompt",
        prompt: "/goal ship the Codex-style goal card",
        capturedAt: 100,
      },
    ]);

    assert.equal(snapshot?.objective, "ship the Codex-style goal card");
    assert.equal(snapshot?.status, "active");
    assert.equal(snapshot?.source, "slash_command");
  });

  it("creates a goal from create_goal and marks it complete from update_goal", () => {
    const snapshot = deriveLatestGoalSnapshot("session-1", [
      {
        type: "assistant",
        capturedAt: 100,
        uuid: "turn-1",
        message: {
          content: [
            {
              type: "tool_use",
              id: "goal-1",
              name: "create_goal",
              input: {
                objective: "finish the release",
                token_budget: 5000,
              },
            },
          ],
        },
      },
      {
        type: "assistant",
        capturedAt: 200,
        uuid: "turn-2",
        message: {
          content: [
            {
              type: "tool_use",
              id: "goal-2",
              name: "update_goal",
              input: {
                status: "complete",
              },
            },
          ],
        },
      },
    ]);

    assert.equal(snapshot?.objective, "finish the release");
    assert.equal(snapshot?.status, "complete");
    assert.equal(snapshot?.tokenBudget, 5000);
    assert.equal(snapshot?.source, "update_goal");
  });

  it("merges get_goal tool results into the latest snapshot", () => {
    const snapshot = deriveLatestGoalSnapshot("session-1", [
      {
        type: "user_prompt",
        prompt: "/goal remove the confusing billing display",
        capturedAt: 100,
      },
      {
        type: "assistant",
        capturedAt: 200,
        message: {
          content: [
            {
              type: "tool_use",
              id: "goal-read-1",
              name: "get_goal",
              input: {},
            },
          ],
        },
      },
      {
        type: "user",
        capturedAt: 300,
        message: {
          content: [
            {
              type: "tool_result",
              tool_use_id: "goal-read-1",
              content: JSON.stringify({
                objective: "remove the confusing billing display",
                status: "active",
                token_budget: 8000,
                token_usage: 3200,
                elapsed_ms: 1200,
              }),
            },
          ],
        },
      },
    ]);

    assert.equal(snapshot?.objective, "remove the confusing billing display");
    assert.equal(snapshot?.status, "active");
    assert.equal(snapshot?.tokenBudget, 8000);
    assert.equal(snapshot?.tokenUsage, 3200);
    assert.equal(snapshot?.elapsedMs, 1200);
    assert.equal(snapshot?.source, "get_goal");
  });

  it("keeps get_goal results when a full live message window is re-derived", () => {
    const messages = [
      {
        type: "assistant",
        capturedAt: 100,
        message: {
          content: [
            {
              type: "tool_use",
              id: "goal-read-live",
              name: "get_goal",
              input: {},
            },
          ],
        },
      },
      {
        type: "user",
        capturedAt: 200,
        message: {
          content: [
            {
              type: "tool_result",
              tool_use_id: "goal-read-live",
              content: JSON.stringify({
                objective: "show goal state while running",
                status: "active",
                token_budget: 10000,
                token_usage: 2500,
              }),
            },
          ],
        },
      },
    ];

    const snapshot = deriveLatestGoalSnapshot("live-session", messages);
    assert.equal(snapshot?.objective, "show goal state while running");
    assert.equal(snapshot?.tokenBudget, 10000);
    assert.equal(snapshot?.tokenUsage, 2500);
    assert.equal(snapshot?.source, "get_goal");
  });

  it("derives live goal state from the trimmed message window in the UI store", () => {
    const source = readFileSync("src/ui/store/useAppStore.ts", "utf8");

    assert.match(
      source,
      /latestGoal:\s*deriveLatestGoalSnapshot\(session\.id,\s*trimmed\.messages,\s*session\.latestGoal\)/,
    );
    assert.match(
      source,
      /latestGoal:\s*deriveLatestGoalSnapshot\(sessionId,\s*mergedMessages,\s*existing\.latestGoal\)/,
    );
  });

  it("renders the active goal on the prompt composer surface", () => {
    const promptInputSource = readFileSync("src/ui/components/prompt-input/PromptInput.tsx", "utf8");
    const activityRailSource = readFileSync("src/ui/components/ActivityRail.tsx", "utf8");

    assert.match(promptInputSource, /prompt-composer-goal/);
    assert.match(promptInputSource, /进行中的目标/);
    assert.match(promptInputSource, /session\?\.status !== "running"/);
    assert.match(promptInputSource, /dismissedGoalKeyBySessionId/);
    assert.match(promptInputSource, /visibleGoal/);
    assert.match(promptInputSource, /aria-label="隐藏当前目标"/);
    assert.match(promptInputSource, /rounded-2xl/);
    assert.doesNotMatch(promptInputSource, /rounded-\[28px\]/);
    assert.doesNotMatch(promptInputSource, /rounded-t-\[28px\]/);
    assert.doesNotMatch(promptInputSource, /border-b-0/);
    assert.doesNotMatch(activityRailSource, /GoalProgressPanel/);
  });

  it("keeps goal mode as a compact prompt composer button", () => {
    const source = readFileSync("src/ui/components/prompt-input/PromptInput.tsx", "utf8");

    assert.match(source, /formatGoalModePrompt/);
    assert.match(source, /\/goal \$\{trimmed\}/);
    assert.match(source, /aria-pressed=\{goalModeEnabled\}/);
    assert.match(source, /title="追求目标"/);
    assert.match(source, /grid h-8 w-8 place-items-center rounded-lg border/);
    assert.match(source, /border-\[#34c759\]/);
    assert.doesNotMatch(source, />追求目标<\/span>/);
    assert.doesNotMatch(source, /h-4 w-7/);
  });
});
