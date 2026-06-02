import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parseWorkflowMarkdown, type WorkflowSpecDocument } from "../../src/shared/workflow-markdown.js";
import { selectWorkflowCandidates } from "../../src/shared/workflow-selector.js";

function createWorkflowDocument(overrides: Partial<WorkflowSpecDocument>): WorkflowSpecDocument {
  return {
    workflowId: "base-workflow",
    name: "Base Workflow",
    version: "1.0.0",
    scope: "user",
    mode: "single-thread",
    entry: "manual",
    owner: "user",
    autoAdvance: false,
    autoBind: false,
    title: "Base Workflow",
    sections: {
      goal: "Goal",
      rules: "Rules",
    },
    steps: [
      {
        id: "STEP-1",
        title: "Inspect",
        executor: "primary-agent",
        intent: "inspect",
        doneWhen: "Done",
        body: "Inspect the project.",
      },
    ],
    rawMarkdown: "",
    ...overrides,
  };
}

test("selectWorkflowCandidates prefers path and tag matched project workflows", () => {
  const genericWorkflow = createWorkflowDocument({
    workflowId: "generic-bugfix",
    name: "Generic Bugfix",
    autoBind: true,
    priority: 40,
    triggers: ["fix"],
  });
  const reactWorkflow = createWorkflowDocument({
    workflowId: "react-bugfix",
    name: "React Bugfix",
    scope: "project",
    autoBind: true,
    priority: 80,
    triggers: ["button broken", "style issue"],
    matchTags: ["frontend", "react"],
    appliesToPaths: ["src/ui/**"],
  });

  const result = selectWorkflowCandidates([genericWorkflow, reactWorkflow], {
    prompt: "This React page has a button broken and a style issue.",
    cwd: "D:/tool/tech-cc-hub",
    activePaths: ["D:/tool/tech-cc-hub/src/ui/components/Button.tsx"],
    tags: ["frontend", "react"],
  });

  assert.equal(result.recommendedWorkflowId, "react-bugfix");
  assert.equal(result.autoSelectedWorkflowId, "react-bugfix");
  assert.equal(result.candidates[0]?.document.workflowId, "react-bugfix");
  assert.deepEqual(result.candidates[0]?.matchedPaths, ["src/ui/**"]);
});

test("selectWorkflowCandidates filters out workflows excluded by tags or paths", () => {
  const frontendWorkflow = createWorkflowDocument({
    workflowId: "frontend-bugfix",
    scope: "project",
    autoBind: true,
    priority: 75,
    appliesToPaths: ["src/ui/**"],
  });
  const backendWorkflow = createWorkflowDocument({
    workflowId: "backend-bugfix",
    scope: "project",
    autoBind: true,
    priority: 90,
    excludeTags: ["frontend"],
  });
  const scriptsWorkflow = createWorkflowDocument({
    workflowId: "scripts-maintenance",
    scope: "project",
    autoBind: true,
    priority: 95,
    excludePaths: ["src/ui/**"],
  });

  const result = selectWorkflowCandidates([frontendWorkflow, backendWorkflow, scriptsWorkflow], {
    activePaths: ["D:/tool/tech-cc-hub/src/ui/App.tsx"],
    tags: ["frontend"],
  });

  assert.deepEqual(
    result.candidates.map((candidate) => candidate.document.workflowId),
    ["frontend-bugfix"],
  );
});

test("selectWorkflowCandidates keeps recommendation but avoids auto-bind when candidates are too close", () => {
  const workflowA = createWorkflowDocument({
    workflowId: "bugfix-a",
    autoBind: true,
    priority: 60,
    triggers: ["fix"],
  });
  const workflowB = createWorkflowDocument({
    workflowId: "bugfix-b",
    autoBind: true,
    priority: 58,
    triggers: ["fix"],
  });

  const result = selectWorkflowCandidates([workflowA, workflowB], {
    prompt: "Please help me fix this issue.",
  });

  assert.equal(result.recommendedWorkflowId, "bugfix-a");
  assert.equal(result.autoSelectedWorkflowId, undefined);
});

test("selectWorkflowCandidates auto-selects visual multitask workflow for browser annotations", () => {
  const markdown = readFileSync(
    join(process.cwd(), ".claude/workflows/visual-multitask-ui-fix.md"),
    "utf8",
  );
  const parsed = parseWorkflowMarkdown(markdown);
  assert.equal(parsed.ok, true, parsed.errors.map((error) => error.message).join("\n"));
  assert.ok(parsed.document);

  const genericWorkflow = createWorkflowDocument({
    workflowId: "product-to-implementation-qa",
    name: "Product to implementation",
    scope: "project",
    autoBind: true,
    priority: 92,
    triggers: ["创建功能", "代码实现", "QA测试"],
    appliesToPaths: ["src/**"],
  });

  const result = selectWorkflowCandidates([genericWorkflow, parsed.document], {
    prompt: [
      "根据这些页面标注做批量 UI 修改，多个组件可以并行处理。",
      "<browser_annotations>",
      "{\"items\":[{\"comment\":\"按钮间距太大\",\"expectation\":\"压缩间距\"}]}",
      "</browser_annotations>",
    ].join("\n"),
    cwd: process.cwd(),
    activePaths: [
      join(process.cwd(), "src/ui/components/BrowserWorkbenchPage.tsx"),
      join(process.cwd(), "src/ui/components/prompt-input/PromptInput.tsx"),
    ],
    tags: ["frontend", "browser", "visual"],
  });

  assert.equal(result.recommendedWorkflowId, "visual-multitask-ui-fix");
  assert.equal(result.autoSelectedWorkflowId, "visual-multitask-ui-fix");
  assert.equal(result.candidates[0]?.document.workflowId, "visual-multitask-ui-fix");
  assert.ok(result.candidates[0]?.matchedTriggers.includes("<browser_annotations>"));
});
