import type {
  BrowserWorkbenchRecordedAction,
  BrowserWorkbenchRecordingArtifact,
  BrowserWorkbenchRecordingDataScenario,
  BrowserWorkbenchRecordingDiagnostic,
  BrowserWorkbenchRecordingDocument,
  BrowserWorkbenchRecordingEnvironment,
  BrowserWorkbenchRecordingEvidence,
  BrowserWorkbenchRecordingLocatorCandidate,
  BrowserWorkbenchRecordingPackage,
  BrowserWorkbenchRecordingResult,
  BrowserWorkbenchRecordingSession,
  BrowserWorkbenchRecordingSuite,
  BrowserWorkbenchRecordingTarget,
} from "./types.js";
import { isSameRecordingUrl, safeRecordingText } from "./recorder-session.js";

type GeneratedActionStep = {
  action: BrowserWorkbenchRecordedAction;
  index: number;
  locatorName?: string;
  dataKey?: string;
};

type FinalizeBrowserWorkbenchRecordingOptions = {
  evidence?: Partial<BrowserWorkbenchRecordingEvidence>;
};

function jsString(value: string): string {
  return JSON.stringify(value);
}

function cssLocator(target?: BrowserWorkbenchRecordingTarget, pageRef = "page"): string | null {
  return target?.selector ? `${pageRef}.locator(${jsString(target.selector)})` : null;
}

function roleLocator(target?: BrowserWorkbenchRecordingTarget, pageRef = "page"): string | null {
  if (!target?.role || !target.name) return null;
  return `${pageRef}.getByRole(${jsString(target.role)}, { name: ${jsString(target.name)} })`;
}

function textLocator(target?: BrowserWorkbenchRecordingTarget, pageRef = "page"): string | null {
  if (!target?.text) return null;
  return `${pageRef}.getByText(${jsString(target.text)}, { exact: true })`;
}

function locatorForTarget(target?: BrowserWorkbenchRecordingTarget, pageRef = "page"): string {
  return roleLocator(target, pageRef) ?? cssLocator(target, pageRef) ?? textLocator(target, pageRef) ?? `${pageRef}.locator('body')`;
}

function locatorForAction(action: BrowserWorkbenchRecordedAction): string {
  return locatorForTarget(action.target);
}

function sanitizeTestName(title?: string, url?: string): string {
  const base = safeRecordingText(title, 80) ?? safeRecordingText(url, 80) ?? "recorded browser flow";
  return base.replace(/[^\w\s:/.-]+/g, " ").replace(/\s+/g, " ").trim() || "recorded browser flow";
}

function toSlug(value: string, fallback: string): string {
  const slug = value
    .toLowerCase()
    .replace(/https?:\/\//g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 56);
  return slug || fallback;
}

function packageSlugForSession(session: BrowserWorkbenchRecordingSession): string {
  return toSlug(sanitizeTestName(session.startTitle, session.startUrl), "recorded-flow");
}

function fileNameForSession(session: BrowserWorkbenchRecordingSession): string {
  const source = packageSlugForSession(session);
  const stamp = new Date(session.startedAt).toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  return `${source}-${stamp}.spec.ts`;
}

function toWords(value: string): string[] {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^a-zA-Z0-9]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function toPascalCase(value: string, fallback: string): string {
  const words = toWords(value);
  const name = words
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`)
    .join("");
  return name && /^[A-Za-z]/.test(name) ? name : fallback;
}

function toCamelCase(value: string, fallback: string): string {
  const pascal = toPascalCase(value, fallback.charAt(0).toUpperCase() + fallback.slice(1));
  const camel = `${pascal.charAt(0).toLowerCase()}${pascal.slice(1)}`;
  return /^[A-Za-z_$][\w$]*$/.test(camel) ? camel : fallback;
}

function dedupeName(base: string, usedNames: Set<string>): string {
  let candidate = base || "recordedElement";
  let counter = 2;
  while (usedNames.has(candidate)) {
    candidate = `${base}${counter}`;
    counter += 1;
  }
  usedNames.add(candidate);
  return candidate;
}

function labelForTarget(target: BrowserWorkbenchRecordingTarget | undefined, fallback: string): string {
  return target?.name ?? target?.text ?? target?.selector ?? target?.tagName ?? fallback;
}

function roleOrTagForTarget(target?: BrowserWorkbenchRecordingTarget): string {
  return target?.role ?? target?.tagName ?? "element";
}

function targetIdentityKey(target?: BrowserWorkbenchRecordingTarget): string {
  if (!target) return "";
  return [
    target.selector ?? "",
    target.role ?? "",
    target.name ?? "",
    target.text ?? "",
    target.tagName ?? "",
    target.inputType ?? "",
  ].join("\u0000");
}

function isLocatorAction(action: BrowserWorkbenchRecordedAction): boolean {
  return action.kind === "click" ||
    action.kind === "fill" ||
    action.kind === "select" ||
    action.kind === "check" ||
    action.kind === "uncheck" ||
    action.kind === "assertVisible" ||
    action.kind === "assertText" ||
    action.kind === "assertCount" ||
    action.kind === "assertAttribute";
}

function isDataAction(action: BrowserWorkbenchRecordedAction): boolean {
  return action.kind === "fill" || action.kind === "select";
}

function buildGeneratedActionSteps(session: BrowserWorkbenchRecordingSession): GeneratedActionStep[] {
  const usedLocatorNames = new Set<string>();
  const locatorNamesByTarget = new Map<string, string>();
  const usedDataKeys = new Set<string>();
  return session.actions.map((action, index) => {
    const step: GeneratedActionStep = { action, index };
    if (isLocatorAction(action)) {
      const targetKey = targetIdentityKey(action.target);
      const existingName = targetKey ? locatorNamesByTarget.get(targetKey) : undefined;
      if (existingName) {
        step.locatorName = existingName;
      } else {
        const label = labelForTarget(action.target, `action ${index + 1}`);
        const base = toCamelCase(`${label} ${roleOrTagForTarget(action.target)}`, `recordedElement${index + 1}`);
        step.locatorName = dedupeName(base, usedLocatorNames);
        if (targetKey) locatorNamesByTarget.set(targetKey, step.locatorName);
      }
    }
    if (isDataAction(action)) {
      const base = step.locatorName ?? toCamelCase(`value ${index + 1}`, `value${index + 1}`);
      step.dataKey = dedupeName(base, usedDataKeys);
    }
    return step;
  });
}

function pageClassNameForSession(session: BrowserWorkbenchRecordingSession): string {
  return `${toPascalCase(packageSlugForSession(session), "RecordedFlow")}RecordedPage`;
}

function buildRecordedData(steps: GeneratedActionStep[]): Record<string, string> {
  const data: Record<string, string> = {};
  for (const step of steps) {
    if (!step.dataKey) continue;
    data[step.dataKey] = step.action.value ?? "";
  }
  return data;
}

function buildDataScenarios(steps: GeneratedActionStep[]): BrowserWorkbenchRecordingDataScenario[] {
  return [
    {
      name: "recorded",
      data: buildRecordedData(steps),
    },
  ];
}

function environmentForSession(session: BrowserWorkbenchRecordingSession): BrowserWorkbenchRecordingEnvironment {
  try {
    const url = new URL(session.startUrl || "about:blank");
    const startPath = `${url.pathname || "/"}${url.search}${url.hash}`;
    return {
      baseURL: url.origin === "null" ? session.startUrl || "about:blank" : url.origin,
      startPath,
      viewport: session.viewport,
      browserName: "chromium",
      headless: true,
      trace: "on",
      screenshot: "only-on-failure",
      video: "retain-on-failure",
    };
  } catch {
    return {
      baseURL: session.startUrl || "about:blank",
      startPath: session.startUrl || "about:blank",
      viewport: session.viewport,
      browserName: "chromium",
      headless: true,
      trace: "on",
      screenshot: "only-on-failure",
      video: "retain-on-failure",
    };
  }
}

function suiteForSession(session: BrowserWorkbenchRecordingSession): BrowserWorkbenchRecordingSuite {
  return {
    id: `${session.id}-suite`,
    name: sanitizeTestName(session.startTitle, session.startUrl),
    tags: ["browser-workbench", "recorded"],
    retries: 0,
    workers: 1,
    projects: ["chromium"],
  };
}

function isAssertionAction(action: BrowserWorkbenchRecordedAction): boolean {
  return action.kind.startsWith("assert");
}

function screenshotName(value: string | undefined, fallback: string): string {
  const base = toSlug(value || fallback, fallback);
  return `${base}.png`;
}

function numericCount(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildDiagnostics(
  session: BrowserWorkbenchRecordingSession,
  locatorCandidates: BrowserWorkbenchRecordingLocatorCandidate[],
  dataScenarios: BrowserWorkbenchRecordingDataScenario[],
): BrowserWorkbenchRecordingDiagnostic[] {
  const diagnostics: BrowserWorkbenchRecordingDiagnostic[] = [];
  const candidatesByAction = new Map<string, BrowserWorkbenchRecordingLocatorCandidate[]>();
  for (const candidate of locatorCandidates) {
    const current = candidatesByAction.get(candidate.actionId) ?? [];
    current.push(candidate);
    candidatesByAction.set(candidate.actionId, current);
  }

  for (const action of session.actions) {
    if (!isLocatorAction(action)) continue;
    const candidates = candidatesByAction.get(action.id) ?? [];
    const hasStableCandidate = candidates.some((candidate) => candidate.stable === true);
    if (!hasStableCandidate) {
      diagnostics.push({
        id: `${action.id}-fragile-selector`,
        type: "fragile-selector",
        severity: "warning",
        actionId: action.id,
        message: "This action is not backed by a stable test id or role locator.",
        suggestion: "Prefer data-testid, role+name, or a purpose-built selector before adding this flow to CI.",
      });
    }
  }

  if (!session.actions.some(isAssertionAction)) {
    diagnostics.push({
      id: `${session.id}-missing-assertion`,
      type: "missing-assertion",
      severity: "warning",
      message: "The recording has no explicit assertion.",
      suggestion: "Add a visible, text, URL, title, count, attribute, screenshot, or response assertion before using it as a regression test.",
    });
  }

  if (dataScenarios.some((scenario) => Object.keys(scenario.data).length > 0)) {
    diagnostics.push({
      id: `${session.id}-data-driven`,
      type: "hard-coded-data",
      severity: "info",
      message: "Recorded input values were extracted into editable data scenarios.",
      suggestion: "Add more scenarios in the data artifact to cover boundary cases.",
    });
  }

  if (session.actions.length > 80) {
    diagnostics.push({
      id: `${session.id}-action-volume`,
      type: "action-volume",
      severity: "warning",
      message: "The recording has many steps and may be hard to maintain as one flow.",
      suggestion: "Split the recording into smaller suites or reusable flows.",
    });
  }

  return diagnostics;
}

function actionLine(action: BrowserWorkbenchRecordedAction, previous?: BrowserWorkbenchRecordedAction): string | null {
  const locator = locatorForAction(action);
  if (action.kind === "click") return `  await ${locator}.click();`;
  if (action.kind === "fill") return `  await ${locator}.fill(${jsString(action.value ?? "")});`;
  if (action.kind === "select") return `  await ${locator}.selectOption(${jsString(action.value ?? "")});`;
  if (action.kind === "check") return `  await ${locator}.check();`;
  if (action.kind === "uncheck") return `  await ${locator}.uncheck();`;
  if (action.kind === "press") return `  await page.keyboard.press(${jsString(action.key ?? "")});`;
  if (action.kind === "scroll") {
    const x = Math.max(0, Math.round(action.scrollX ?? 0));
    const y = Math.max(0, Math.round(action.scrollY ?? 0));
    return `  await page.evaluate(() => window.scrollTo(${x}, ${y}));`;
  }
  if (action.kind === "assertVisible") return `  await expect(${locator}).toBeVisible();`;
  if (action.kind === "assertText") return `  await expect(${locator}).toContainText(${jsString(action.target?.text ?? action.target?.name ?? "")});`;
  if (action.kind === "assertUrl") return `  await expect(page).toHaveURL(${jsString(action.value ?? action.url)});`;
  if (action.kind === "assertTitle") return `  await expect(page).toHaveTitle(${jsString(action.value ?? action.title ?? "")});`;
  if (action.kind === "assertCount") return `  await expect(${locator}).toHaveCount(${numericCount(action.value)});`;
  if (action.kind === "assertAttribute") return `  await expect(${locator}).toHaveAttribute(${jsString(action.key ?? "")}, ${jsString(action.value ?? "")});`;
  if (action.kind === "assertScreenshot") return `  await expect(page).toHaveScreenshot(${jsString(screenshotName(action.value, `step-${action.id}`))});`;
  if (action.kind === "assertResponse") return `  await page.waitForResponse((response) => response.url().includes(${jsString(action.value ?? "")}) && response.ok());`;
  if (action.kind === "navigate") {
    if (previous?.kind === "click" || previous?.kind === "press") {
      return `  await expect(page).toHaveURL(${jsString(action.url)});`;
    }
    return `  await page.goto(${jsString(action.url)});`;
  }
  return null;
}

export function buildBrowserWorkbenchPlaywrightScript(session: BrowserWorkbenchRecordingSession): string {
  const testName = sanitizeTestName(session.startTitle, session.startUrl);
  const lines = [
    "import { test, expect } from '@playwright/test';",
    "",
    `test(${jsString(testName)}, async ({ page }) => {`,
    `  await page.goto(${jsString(session.startUrl || "about:blank")});`,
  ];

  let previous: BrowserWorkbenchRecordedAction | undefined;
  for (const action of session.actions) {
    if (action.kind === "navigate" && isSameRecordingUrl(action.url, session.startUrl) && !previous) {
      continue;
    }
    const line = actionLine(action, previous);
    if (line) {
      lines.push(line);
      previous = action;
    }
  }

  lines.push("});", "");
  return lines.join("\n");
}

function parseAttributeSelector(selector: string, name: string): string | null {
  const pattern = new RegExp(`\\[${name}=(["']?)([^"'\\]]+)\\1\\]`);
  return selector.match(pattern)?.[2] ?? null;
}

function buildLocatorCandidates(action: BrowserWorkbenchRecordedAction): BrowserWorkbenchRecordingLocatorCandidate[] {
  const candidates: BrowserWorkbenchRecordingLocatorCandidate[] = [];
  const target = action.target;
  if (!target) return candidates;

  const testId = target.selector
    ? parseAttributeSelector(target.selector, "data-testid")
      ?? parseAttributeSelector(target.selector, "data-test")
      ?? parseAttributeSelector(target.selector, "data-cy")
      ?? parseAttributeSelector(target.selector, "data-qa")
    : null;
  if (testId) {
    candidates.push({
      actionId: action.id,
      strategy: "testId",
      value: testId,
      stable: true,
      reason: "Recorded stable test attribute selector.",
    });
  }
  if (target.role && target.name) {
    candidates.push({
      actionId: action.id,
      strategy: "role",
      value: `${target.role}:${target.name}`,
      stable: true,
      reason: "Recorded role and accessible name.",
    });
  }
  if (target.text) {
    candidates.push({
      actionId: action.id,
      strategy: "text",
      value: target.text,
      stable: false,
      reason: "Text selectors can drift when copy changes.",
    });
  }
  if (target.selector) {
    candidates.push({
      actionId: action.id,
      strategy: "css",
      value: target.selector,
      stable: Boolean(testId),
      reason: testId ? "CSS selector is backed by a stable test attribute." : "CSS fallback should be validated before generation.",
    });
  }
  return candidates;
}

export function buildBrowserWorkbenchRecordingDocument(
  session: BrowserWorkbenchRecordingSession,
  completedAt = Date.now(),
  options: FinalizeBrowserWorkbenchRecordingOptions = {},
): BrowserWorkbenchRecordingDocument {
  const locatorCandidates = session.actions.flatMap(buildLocatorCandidates);
  const steps = buildGeneratedActionSteps(session);
  const dataScenarios = buildDataScenarios(steps);
  const diagnostics = buildDiagnostics(session, locatorCandidates, dataScenarios);
  const hasAssertions = session.actions.some(isAssertionAction);
  const hasExpandedAssertions = session.actions.some((action) => isAssertionAction(action) && action.kind !== "assertVisible" && action.kind !== "assertText");
  const environment = environmentForSession(session);
  const suite = suiteForSession(session);
  return {
    schemaVersion: 1,
    id: session.id,
    createdAt: completedAt,
    startedAt: session.startedAt,
    completedAt,
    source: {
      url: session.startUrl,
      title: session.startTitle,
      viewport: session.viewport,
    },
    capabilities: {
      rawActions: true,
      locatorCandidates: locatorCandidates.length > 0,
      assertions: hasAssertions,
      replay: true,
      repairLoop: true,
      runEvents: true,
      traceViewer: true,
      scriptEditing: true,
      suites: true,
      parameterizedEnvironment: true,
      dataDriven: true,
      diagnostics: true,
      expandedAssertions: hasExpandedAssertions,
    },
    environment,
    dataScenarios,
    suite,
    diagnostics,
    actions: [...session.actions],
    locatorCandidates,
    evidence: {
      screenshots: options.evidence?.screenshots ?? [],
      snapshots: options.evidence?.snapshots ?? [],
      network: options.evidence?.network ?? [],
      console: options.evidence?.console ?? [],
    },
  };
}

function buildPageObject(session: BrowserWorkbenchRecordingSession, steps: GeneratedActionStep[]): string {
  const className = pageClassNameForSession(session);
  const seenLocatorNames = new Set<string>();
  const locatorSteps = steps.filter((step) => {
    if (!step.locatorName || seenLocatorNames.has(step.locatorName)) return false;
    seenLocatorNames.add(step.locatorName);
    return true;
  });
  const lines = [
    "import type { Locator, Page } from '@playwright/test';",
    "",
    `export class ${className} {`,
    "  constructor(private readonly page: Page) {}",
  ];

  if (!locatorSteps.length) {
    lines.push("", "  get body(): Locator {", "    return this.page.locator('body');", "  }");
  }

  for (const step of locatorSteps) {
    lines.push(
      "",
      `  get ${step.locatorName}(): Locator {`,
      `    return ${locatorForTarget(step.action.target, "this.page")};`,
      "  }",
    );
  }

  lines.push("}", "");
  return lines.join("\n");
}

function buildFlow(session: BrowserWorkbenchRecordingSession, steps: GeneratedActionStep[]): string {
  const className = pageClassNameForSession(session);
  const data = buildRecordedData(steps);
  const dataEntries = Object.keys(data);
  const dataType = dataEntries.length
    ? [
      "export type RecordedFlowData = {",
      ...dataEntries.map((key) => `  ${key}: string;`),
      "};",
    ].join("\n")
    : "export type RecordedFlowData = Record<string, never>;";
  const lines = [
    "import { expect, type Page } from '@playwright/test';",
    `import { ${className} } from '../pages/${className}.po';`,
    "",
    dataType,
    "",
    "export async function runRecordedFlow(page: Page, data: RecordedFlowData): Promise<void> {",
    `  const recordedPage = new ${className}(page);`,
  ];

  let previous: BrowserWorkbenchRecordedAction | undefined;
  for (const step of steps) {
    const { action } = step;
    if (action.kind === "navigate" && isSameRecordingUrl(action.url, session.startUrl) && !previous) {
      continue;
    }
    if (action.kind === "click" && step.locatorName) {
      lines.push(`  await recordedPage.${step.locatorName}.click();`);
    } else if (action.kind === "fill" && step.locatorName && step.dataKey) {
      lines.push(`  await recordedPage.${step.locatorName}.fill(data.${step.dataKey});`);
    } else if (action.kind === "select" && step.locatorName && step.dataKey) {
      lines.push(`  await recordedPage.${step.locatorName}.selectOption(data.${step.dataKey});`);
    } else if (action.kind === "check" && step.locatorName) {
      lines.push(`  await recordedPage.${step.locatorName}.check();`);
    } else if (action.kind === "uncheck" && step.locatorName) {
      lines.push(`  await recordedPage.${step.locatorName}.uncheck();`);
    } else if (action.kind === "assertVisible" && step.locatorName) {
      lines.push(`  await expect(recordedPage.${step.locatorName}).toBeVisible();`);
    } else if (action.kind === "assertText" && step.locatorName) {
      lines.push(`  await expect(recordedPage.${step.locatorName}).toContainText(${jsString(action.target?.text ?? action.target?.name ?? "")});`);
    } else if (action.kind === "assertUrl") {
      lines.push(`  await expect(page).toHaveURL(${jsString(action.value ?? action.url)});`);
    } else if (action.kind === "assertTitle") {
      lines.push(`  await expect(page).toHaveTitle(${jsString(action.value ?? action.title ?? "")});`);
    } else if (action.kind === "assertCount" && step.locatorName) {
      lines.push(`  await expect(recordedPage.${step.locatorName}).toHaveCount(${numericCount(action.value)});`);
    } else if (action.kind === "assertAttribute" && step.locatorName) {
      lines.push(`  await expect(recordedPage.${step.locatorName}).toHaveAttribute(${jsString(action.key ?? "")}, ${jsString(action.value ?? "")});`);
    } else if (action.kind === "assertScreenshot") {
      lines.push(`  await expect(page).toHaveScreenshot(${jsString(screenshotName(action.value, `step-${step.index + 1}`))});`);
    } else if (action.kind === "assertResponse") {
      lines.push(`  await page.waitForResponse((response) => response.url().includes(${jsString(action.value ?? "")}) && response.ok());`);
    } else if (action.kind === "press") {
      lines.push(`  await page.keyboard.press(${jsString(action.key ?? "")});`);
    } else if (action.kind === "scroll") {
      const x = Math.max(0, Math.round(action.scrollX ?? 0));
      const y = Math.max(0, Math.round(action.scrollY ?? 0));
      lines.push(`  await page.evaluate(() => window.scrollTo(${x}, ${y}));`);
    } else if (action.kind === "navigate") {
      if (previous?.kind === "click" || previous?.kind === "press") {
        lines.push(`  await expect(page).toHaveURL(${jsString(action.url)});`);
      } else {
        lines.push(`  await page.goto(${jsString(action.url)});`);
      }
    }
    previous = action;
  }

  if (lines[lines.length - 1] === `  const recordedPage = new ${className}(page);`) {
    lines.push("  await expect(page.locator('body')).toBeVisible();");
  }

  lines.push("}", "");
  return lines.join("\n");
}

function buildEnvironment(environment: BrowserWorkbenchRecordingEnvironment): string {
  return [
    "export const recordingEnvironment = ",
    `${JSON.stringify(environment, null, 2)} as const;`,
    "",
    "export type RecordingEnvironment = typeof recordingEnvironment;",
    "",
  ].join("\n");
}

function buildFixture(session: BrowserWorkbenchRecordingSession, _steps: GeneratedActionStep[], dataScenarios: BrowserWorkbenchRecordingDataScenario[]): string {
  const slug = packageSlugForSession(session);
  return [
    "import { readFileSync } from 'node:fs';",
    "import { dirname, resolve } from 'node:path';",
    "import { fileURLToPath } from 'node:url';",
    "import { test as base, expect } from '@playwright/test';",
    `import { recordingEnvironment } from '../environment/${slug}.environment';`,
    `import { runRecordedFlow, type RecordedFlowData } from '../flows/${slug}.flow';`,
    "",
    "const currentDirectory = dirname(fileURLToPath(import.meta.url));",
    `const dataPath = resolve(currentDirectory, '../data/${slug}.data.json');`,
    "const dataScenarios = JSON.parse(readFileSync(dataPath, 'utf8')) as Array<{ name: string; data: RecordedFlowData }>;",
    "",
    "export const test = base;",
    `export const recordedFlowDataScenarios: Array<{ name: string; data: RecordedFlowData }> = dataScenarios.length ? dataScenarios : ${JSON.stringify(dataScenarios, null, 2)};`,
    "export { recordingEnvironment };",
    "",
    "export { expect, runRecordedFlow };",
    "",
  ].join("\n");
}

function buildGeneratedSpec(session: BrowserWorkbenchRecordingSession): string {
  const testName = sanitizeTestName(session.startTitle, session.startUrl);
  const slug = packageSlugForSession(session);
  return [
    `import { test, runRecordedFlow, recordedFlowDataScenarios, recordingEnvironment } from "../fixtures/${slug}.fixture";`,
    "",
    "for (const scenario of recordedFlowDataScenarios) {",
    `  test(\`${testName} - \${scenario.name}\`, async ({ page }) => {`,
    "    await page.setViewportSize(recordingEnvironment.viewport ?? { width: 1280, height: 720 });",
    "    await page.goto(new URL(recordingEnvironment.startPath, recordingEnvironment.baseURL).toString());",
    "    await runRecordedFlow(page, scenario.data);",
    "  });",
    "}",
    "",
  ].join("\n");
}

function buildSuite(suite: BrowserWorkbenchRecordingSuite, generatedSpecPath: string): string {
  return JSON.stringify({
    ...suite,
    specs: [generatedSpecPath],
  }, null, 2);
}

function buildDiagnosticsArtifact(diagnostics: BrowserWorkbenchRecordingDiagnostic[]): string {
  return JSON.stringify({ diagnostics }, null, 2);
}

function buildReadme(recording: BrowserWorkbenchRecordingDocument, artifacts: BrowserWorkbenchRecordingArtifact[]): string {
  const generatedAssets = artifacts
    .filter((artifact) => artifact.kind !== "readme")
    .map((artifact) => `- ${artifact.path}`);
  return [
    `# Browser recording ${recording.id}`,
    "",
    `Start URL: ${recording.source.url || "about:blank"}`,
    `Actions: ${recording.actions.length}`,
    "",
    "## Generated assets",
    "",
    ...generatedAssets,
    "",
    "This package is generated from raw Browser Workbench events. It separates reusable page objects, flows, fixture data, and the final Playwright spec so the suite can be maintained after recording.",
    "",
  ].join("\n");
}

export function buildBrowserWorkbenchRecordingPackage(
  session: BrowserWorkbenchRecordingSession,
  completedAt = Date.now(),
  options: FinalizeBrowserWorkbenchRecordingOptions = {},
): BrowserWorkbenchRecordingPackage {
  const recording = buildBrowserWorkbenchRecordingDocument(session, completedAt, options);
  const steps = buildGeneratedActionSteps(session);
  const dataScenarios = recording.dataScenarios;
  const slug = packageSlugForSession(session);
  const className = pageClassNameForSession(session);
  const fileName = fileNameForSession(session);
  const script = buildGeneratedSpec(session);
  const rootPathHint = `.tech-cc-hub/browser-recordings/${session.id}`;
  const recordingPath = `${rootPathHint}/recording.json`;
  const generatedSpecPath = `${rootPathHint}/generated/specs/${fileName}`;
  const environmentPath = `${rootPathHint}/generated/environment/${slug}.environment.ts`;
  const dataPath = `${rootPathHint}/generated/data/${slug}.data.json`;
  const pagePath = `${rootPathHint}/generated/pages/${className}.po.ts`;
  const flowPath = `${rootPathHint}/generated/flows/${slug}.flow.ts`;
  const fixturePath = `${rootPathHint}/generated/fixtures/${slug}.fixture.ts`;
  const suitePath = `${rootPathHint}/generated/suites/${slug}.suite.json`;
  const diagnosticsPath = `${rootPathHint}/diagnostics.json`;
  const manifestPath = `${rootPathHint}/manifest.json`;
  const readmePath = `${rootPathHint}/README.md`;
  const recordingJson = JSON.stringify(recording, null, 2);
  const artifacts: BrowserWorkbenchRecordingArtifact[] = [
    {
      kind: "recording",
      path: recordingPath,
      content: recordingJson,
      language: "json",
    },
    {
      kind: "environment",
      path: environmentPath,
      content: buildEnvironment(recording.environment),
      language: "typescript",
    },
    {
      kind: "data",
      path: dataPath,
      content: JSON.stringify(dataScenarios, null, 2),
      language: "json",
    },
    {
      kind: "page",
      path: pagePath,
      content: buildPageObject(session, steps),
      language: "typescript",
    },
    {
      kind: "flow",
      path: flowPath,
      content: buildFlow(session, steps),
      language: "typescript",
    },
    {
      kind: "fixture",
      path: fixturePath,
      content: buildFixture(session, steps, dataScenarios),
      language: "typescript",
    },
    {
      kind: "spec",
      path: generatedSpecPath,
      content: script,
      language: "typescript",
    },
    {
      kind: "suite",
      path: suitePath,
      content: buildSuite(recording.suite, generatedSpecPath),
      language: "json",
    },
    {
      kind: "diagnostics",
      path: diagnosticsPath,
      content: buildDiagnosticsArtifact(recording.diagnostics),
      language: "json",
    },
  ];
  const manifest = {
    id: recording.id,
    schemaVersion: recording.schemaVersion,
    sourceUrl: recording.source.url,
    actionCount: recording.actions.length,
    recordingPath,
    generatedSpecPath,
    environmentPath,
    dataPath,
    suitePath,
    diagnosticsPath,
    generatedAt: recording.completedAt,
    suite: {
      id: recording.suite.id,
      name: recording.suite.name,
      tags: recording.suite.tags,
    },
    diagnostics: {
      total: recording.diagnostics.length,
      warnings: recording.diagnostics.filter((diagnostic) => diagnostic.severity === "warning").length,
      errors: recording.diagnostics.filter((diagnostic) => diagnostic.severity === "error").length,
    },
    generatedArtifacts: artifacts.map((artifact) => ({
      kind: artifact.kind,
      path: artifact.path,
      language: artifact.language,
    })),
  };
  artifacts.push(
    {
      kind: "manifest",
      path: manifestPath,
      content: JSON.stringify(manifest, null, 2),
      language: "json",
    },
    {
      kind: "readme",
      path: readmePath,
      content: buildReadme(recording, artifacts),
      language: "markdown",
    },
  );

  return {
    id: session.id,
    createdAt: recording.completedAt,
    rootPathHint,
    recordingPath,
    generatedSpecPath,
    recording,
    environment: recording.environment,
    dataScenarios,
    suite: recording.suite,
    diagnostics: recording.diagnostics,
    artifacts,
  };
}

export function finalizeBrowserWorkbenchRecording(
  session: BrowserWorkbenchRecordingSession,
  options: FinalizeBrowserWorkbenchRecordingOptions = {},
): BrowserWorkbenchRecordingResult {
  const recordingPackage = buildBrowserWorkbenchRecordingPackage(session, Date.now(), options);
  const spec = recordingPackage.artifacts.find((artifact) => artifact.kind === "spec");
  const recording = recordingPackage.artifacts.find((artifact) => artifact.kind === "recording");
  return {
    success: true,
    recording: false,
    id: session.id,
    startedAt: session.startedAt,
    url: session.startUrl,
    title: session.startTitle,
    actionCount: session.actions.length,
    actions: [...session.actions],
    script: buildBrowserWorkbenchPlaywrightScript(session),
    fileName: spec?.path.split("/").pop() ?? fileNameForSession(session),
    recordingJson: recording?.content,
    recordingPackage,
  };
}
