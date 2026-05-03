import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("skill manager initializes a real active scenario before skills are imported", () => {
  const ipcHandlersSource = readFileSync("src/electron/libs/skill-manager/ipc-handlers.ts", "utf8");
  const scenariosSource = readFileSync("src/electron/libs/skill-manager/scenarios.ts", "utf8");

  assert.match(ipcHandlersSource, /ensureDefaultScenario\(\);/);
  assert.match(scenariosSource, /export function ensureDefaultScenario/);
  assert.match(scenariosSource, /setActiveScenario\(id\)/);
});

test("local skill imports use scenario sync path, not database-only membership", () => {
  const ipcHandlersSource = readFileSync("src/electron/libs/skill-manager/ipc-handlers.ts", "utf8");

  assert.match(ipcHandlersSource, /addSkillToScenarioAndSync\(id, activeId\)/);
  assert.match(ipcHandlersSource, /addSkillToScenarioAndSync\(existing\.id, activeId\)/);
  assert.doesNotMatch(ipcHandlersSource, /dbAddSkillToScenario/);
});
