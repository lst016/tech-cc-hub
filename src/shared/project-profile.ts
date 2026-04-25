import type { DevLoopMode, DevLoopTaskKind } from "./dev-loop.js";

export type ProjectStackKind = "frontend" | "backend" | "electron" | "java" | "node" | "python" | "docs" | "unknown";
export type ProjectCommandKind = "install" | "dev" | "build" | "test" | "lint" | "typecheck" | "start" | "custom";
export type PreviewTargetKind = "web" | "electron" | "mobile" | "api-docs" | "unknown";
export type ProjectRuntimePhase = "profile_loaded" | "context_pack_generated";

export type ProjectManifestFile = {
  path: string;
  text: string;
};

export type ProjectStack = {
  kind: ProjectStackKind;
  name: string;
  confidence: number;
  evidence: string[];
};

export type ProjectCommand = {
  id: string;
  label: string;
  command: string;
  cwd: string;
  kind: ProjectCommandKind;
  confidence: number;
  evidence: string[];
  lastRunAt?: number;
  lastStatus?: "success" | "failure" | "unknown";
};

export type PreviewTarget = {
  id: string;
  label: string;
  kind: PreviewTargetKind;
  startCommandId?: string;
  url?: string;
  port?: number;
  readinessCheck?: {
    kind: "http" | "process" | "log";
    value: string;
  };
  screenshotSupported: boolean;
};

export type TestTarget = {
  id: string;
  label: string;
  commandId: string;
  kind: "unit" | "lint" | "build" | "typecheck" | "unknown";
};

export type ProjectEntrypoint = {
  id: string;
  label: string;
  kind: "route" | "component" | "api" | "service" | "style" | "config" | "test";
  path: string;
  matchHints: string[];
  evidence: string[];
};

export type ImportantFile = {
  path: string;
  label: string;
  reason: string;
};

export type ProjectGuardrail = {
  id: string;
  rule: string;
  severity: "info" | "warning" | "block";
  source: "project-doc" | "user" | "history" | "auto";
};

export type ProjectProfileNote = {
  id: string;
  text: string;
  source: "auto" | "user" | "history";
  updatedAt: number;
};

export type ProjectProfile = {
  id: string;
  cwd: string;
  displayName: string;
  detectedAt: number;
  updatedAt: number;
  confidence: number;
  source: "auto" | "user-edited" | "imported";
  stack: ProjectStack[];
  packageManagers: string[];
  commands: ProjectCommand[];
  previewTargets: PreviewTarget[];
  testTargets: TestTarget[];
  entrypoints: ProjectEntrypoint[];
  importantFiles: ImportantFile[];
  guardrails: ProjectGuardrail[];
  notes: ProjectProfileNote[];
};

export type FirstShotContextPack = {
  projectProfileId: string;
  taskKind: DevLoopTaskKind | string;
  loopMode: DevLoopMode;
  selectedEntrypoints: ProjectEntrypoint[];
  selectedCommands: ProjectCommand[];
  selectedPreviewTarget?: PreviewTarget;
  guardrails: ProjectGuardrail[];
  acceptanceCriteria: string[];
  missingContextQuestions: string[];
};

export type ProjectRuntimeMessage = {
  type: "project_runtime";
  phase: ProjectRuntimePhase;
  profileId: string;
  cwd: string;
  summary: string;
  stack: string[];
  commands: string[];
  guardrails: string[];
  previewTarget?: string;
  instructions?: string;
  capturedAt?: number;
  historyId?: string;
};

export type BuildProjectProfileInput = {
  cwd: string;
  files: ProjectManifestFile[];
  now?: number;
};

export type BuildFirstShotContextPackInput = {
  profile: ProjectProfile;
  taskKind: DevLoopTaskKind | string;
  loopMode: DevLoopMode;
  prompt: string;
};

function stableId(...parts: string[]): string {
  return parts
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "item";
}

function basename(path: string): string {
  return path.replace(/[\\/]+$/, "").split(/[\\/]/).filter(Boolean).pop() ?? path;
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/");
}

function getFile(files: ProjectManifestFile[], path: string): ProjectManifestFile | undefined {
  const target = normalizePath(path).toLowerCase();
  return files.find((file) => normalizePath(file.path).toLowerCase() === target);
}

function addStack(stacks: ProjectStack[], item: ProjectStack): void {
  if (stacks.some((existing) => existing.name === item.name)) return;
  stacks.push(item);
}

function inferCommandKind(scriptName: string): ProjectCommandKind {
  const normalized = scriptName.toLowerCase();
  if (normalized === "dev" || normalized.startsWith("dev:")) return "dev";
  if (normalized === "start" || normalized.startsWith("start:")) return "start";
  if (normalized.includes("build")) return "build";
  if (normalized.includes("test")) return "test";
  if (normalized.includes("lint")) return "lint";
  if (normalized.includes("typecheck") || normalized.includes("type-check") || normalized === "tsc") return "typecheck";
  if (normalized.includes("install")) return "install";
  return "custom";
}

function parsePort(text: string): number | undefined {
  const portMatch = text.match(/(?:--port\s+|PORT=|localhost:)(\d{2,5})/i);
  if (!portMatch) return undefined;
  const port = Number(portMatch[1]);
  return Number.isFinite(port) ? port : undefined;
}

function readPackageJson(file: ProjectManifestFile | undefined): Record<string, unknown> | null {
  if (!file) return null;
  try {
    const parsed = JSON.parse(file.text) as Record<string, unknown>;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function collectDependencyNames(packageJson: Record<string, unknown> | null): Set<string> {
  const names = new Set<string>();
  if (!packageJson) return names;

  for (const field of ["dependencies", "devDependencies", "peerDependencies"]) {
    const value = packageJson[field];
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    for (const key of Object.keys(value)) {
      names.add(key.toLowerCase());
    }
  }

  return names;
}

function collectPackageScripts(packageJson: Record<string, unknown> | null): Record<string, string> {
  const scripts = packageJson?.scripts;
  if (!scripts || typeof scripts !== "object" || Array.isArray(scripts)) return {};

  const result: Record<string, string> = {};
  for (const [name, command] of Object.entries(scripts)) {
    if (typeof command === "string") {
      result[name] = command;
    }
  }
  return result;
}

function buildCommands(cwd: string, scripts: Record<string, string>): ProjectCommand[] {
  return Object.keys(scripts).map((scriptName) => {
    const kind = inferCommandKind(scriptName);
    return {
      id: stableId("npm", scriptName),
      label: `npm run ${scriptName}`,
      command: `npm run ${scriptName}`,
      cwd,
      kind,
      confidence: ["dev", "start", "build", "test", "lint", "typecheck"].includes(kind) ? 0.88 : 0.62,
      evidence: [`package.json scripts.${scriptName}=${scripts[scriptName]}`],
    };
  });
}

function detectGuardrails(files: ProjectManifestFile[]): ProjectGuardrail[] {
  const guardrails: ProjectGuardrail[] = [];
  const rulePatterns = [
    /不要[^。\n；;]+/g,
    /不能[^。\n；;]+/g,
    /禁止[^。\n；;]+/g,
    /must not[^.\n]+/gi,
    /do not[^.\n]+/gi,
  ];

  for (const file of files) {
    const normalizedPath = normalizePath(file.path);
    if (!/(^|\/)(AGENTS|CLAUDE|README)\.md$/i.test(normalizedPath)) continue;
    for (const pattern of rulePatterns) {
      const matches = file.text.match(pattern) ?? [];
      for (const match of matches) {
        const rule = match.trim();
        if (!rule || guardrails.some((item) => item.rule === rule)) continue;
        guardrails.push({
          id: stableId(normalizedPath, rule),
          rule,
          severity: /禁止|不能|must not/i.test(rule) ? "warning" : "info",
          source: "project-doc",
        });
      }
    }
  }

  return guardrails;
}

function detectImportantFiles(files: ProjectManifestFile[]): ImportantFile[] {
  return files
    .filter((file) => /(^|\/)(package\.json|pom\.xml|build\.gradle|pyproject\.toml|requirements\.txt|AGENTS\.md|CLAUDE\.md|README.*)$/i.test(normalizePath(file.path)))
    .map((file) => ({
      path: file.path,
      label: file.path,
      reason: "项目画像来源文件",
    }));
}

function detectPreviewTargets(profile: {
  cwd: string;
  dependencies: Set<string>;
  scripts: Record<string, string>;
  commands: ProjectCommand[];
}): PreviewTarget[] {
  const devCommand = profile.commands.find((command) => command.kind === "dev") ?? profile.commands.find((command) => command.kind === "start");
  const devScriptText = devCommand ? profile.scripts[devCommand.command.replace(/^npm run /, "")] ?? "" : "";
  const port = parsePort(devScriptText) ?? (profile.dependencies.has("vite") ? 5173 : undefined);
  const targets: PreviewTarget[] = [];

  if (profile.dependencies.has("electron")) {
    targets.push({
      id: "preview-electron",
      label: "Electron 真窗口",
      kind: "electron",
      startCommandId: devCommand?.id,
      port,
      readinessCheck: port ? { kind: "http", value: `http://localhost:${port}/` } : { kind: "process", value: "electron" },
      screenshotSupported: true,
    });
  }

  if (profile.dependencies.has("vite") || profile.dependencies.has("next") || profile.dependencies.has("react") || profile.dependencies.has("vue")) {
    targets.push({
      id: "preview-web",
      label: "Web 预览",
      kind: "web",
      startCommandId: devCommand?.id,
      url: port ? `http://localhost:${port}/` : undefined,
      port,
      readinessCheck: port ? { kind: "http", value: `http://localhost:${port}/` } : undefined,
      screenshotSupported: true,
    });
  }

  return targets;
}

function detectEntrypoints(files: ProjectManifestFile[]): ProjectEntrypoint[] {
  const entrypoints: ProjectEntrypoint[] = [];
  for (const file of files) {
    const path = normalizePath(file.path);
    if (/src\/main\.(tsx|ts|jsx|js)$/.test(path) || /src\/App\.(tsx|jsx)$/.test(path)) {
      entrypoints.push({
        id: stableId("entry", path),
        label: path,
        kind: "component",
        path: file.path,
        matchHints: ["frontend", "页面", "组件", "UI"],
        evidence: ["常见前端入口文件"],
      });
    }
    if (/controller|route|api/i.test(path)) {
      entrypoints.push({
        id: stableId("entry", path),
        label: path,
        kind: "api",
        path: file.path,
        matchHints: ["api", "接口", "后端"],
        evidence: ["路径包含 API/Controller/Route 信号"],
      });
    }
  }
  return entrypoints;
}

export function buildProjectProfile(input: BuildProjectProfileInput): ProjectProfile {
  const now = input.now ?? Date.now();
  const packageJson = readPackageJson(getFile(input.files, "package.json"));
  const dependencies = collectDependencyNames(packageJson);
  const scripts = collectPackageScripts(packageJson);
  const commands = buildCommands(input.cwd, scripts);
  const stack: ProjectStack[] = [];
  const packageManagers = packageJson ? ["npm"] : [];

  if (packageJson) {
    addStack(stack, { kind: "node", name: "Node.js", confidence: 0.9, evidence: ["package.json"] });
  }
  if (dependencies.has("react")) {
    addStack(stack, { kind: "frontend", name: "React", confidence: 0.92, evidence: ["package.json dependencies.react"] });
  }
  if (dependencies.has("vue")) {
    addStack(stack, { kind: "frontend", name: "Vue", confidence: 0.92, evidence: ["package.json dependencies.vue"] });
  }
  if (dependencies.has("vite")) {
    addStack(stack, { kind: "frontend", name: "Vite", confidence: 0.9, evidence: ["package.json vite"] });
  }
  if (dependencies.has("next")) {
    addStack(stack, { kind: "frontend", name: "Next.js", confidence: 0.9, evidence: ["package.json next"] });
  }
  if (dependencies.has("electron")) {
    addStack(stack, { kind: "electron", name: "Electron", confidence: 0.92, evidence: ["package.json electron"] });
  }
  if (getFile(input.files, "pom.xml")) {
    addStack(stack, { kind: "java", name: "Java", confidence: 0.86, evidence: ["pom.xml"] });
    addStack(stack, { kind: "java", name: "Maven", confidence: 0.86, evidence: ["pom.xml"] });
  }
  if (getFile(input.files, "build.gradle")) {
    addStack(stack, { kind: "java", name: "Gradle", confidence: 0.84, evidence: ["build.gradle"] });
  }
  if (getFile(input.files, "pyproject.toml") || getFile(input.files, "requirements.txt")) {
    addStack(stack, { kind: "python", name: "Python", confidence: 0.84, evidence: ["pyproject.toml/requirements.txt"] });
  }
  if (stack.length === 0) {
    addStack(stack, { kind: "unknown", name: "Unknown", confidence: 0.2, evidence: ["未命中常见项目文件"] });
  }

  const previewTargets = detectPreviewTargets({ cwd: input.cwd, dependencies, scripts, commands });
  const testTargets = commands
    .filter((command) => ["test", "lint", "build", "typecheck"].includes(command.kind))
    .map((command) => ({
      id: stableId("test-target", command.id),
      label: command.label,
      commandId: command.id,
      kind: command.kind === "test" ? "unit" : command.kind === "lint" ? "lint" : command.kind === "build" ? "build" : command.kind === "typecheck" ? "typecheck" : "unknown",
    } satisfies TestTarget));

  return {
    id: stableId("profile", input.cwd),
    cwd: input.cwd,
    displayName: basename(input.cwd),
    detectedAt: now,
    updatedAt: now,
    confidence: Math.max(...stack.map((item) => item.confidence), 0.2),
    source: "auto",
    stack,
    packageManagers,
    commands,
    previewTargets,
    testTargets,
    entrypoints: detectEntrypoints(input.files),
    importantFiles: detectImportantFiles(input.files),
    guardrails: detectGuardrails(input.files),
    notes: [],
  };
}

function commandScore(command: ProjectCommand, taskKind: string, loopMode: DevLoopMode): number {
  let score = command.confidence;
  if (loopMode === "visual-dev" || taskKind === "frontend" || taskKind === "visual") {
    if (command.kind === "dev" || command.kind === "start") score += 0.4;
    if (command.kind === "build") score += 0.25;
    if (command.kind === "lint" || command.kind === "typecheck") score += 0.15;
  } else {
    if (command.kind === "test") score += 0.35;
    if (command.kind === "build" || command.kind === "typecheck") score += 0.25;
    if (command.kind === "lint") score += 0.15;
  }
  return score;
}

export function buildFirstShotContextPack(input: BuildFirstShotContextPackInput): FirstShotContextPack {
  const selectedCommands = input.profile.commands
    .slice()
    .sort((left, right) =>
      commandScore(right, input.taskKind, input.loopMode) - commandScore(left, input.taskKind, input.loopMode)
    )
    .slice(0, 4);
  const selectedPreviewTarget =
    input.loopMode === "electron-window"
      ? input.profile.previewTargets.find((target) => target.kind === "electron") ?? input.profile.previewTargets[0]
      : input.loopMode === "visual-dev"
        ? input.profile.previewTargets.find((target) => target.kind === "web") ?? input.profile.previewTargets[0]
        : undefined;
  const selectedEntrypoints = input.profile.entrypoints
    .filter((entrypoint) => entrypoint.matchHints.some((hint) => input.prompt.toLowerCase().includes(hint.toLowerCase())))
    .slice(0, 5);
  const acceptanceCriteria = [
    "优先复用 Project Profile 中识别出的入口、命令和项目规则。",
    "改动后运行与任务相关的最小验证命令，并报告结果。",
  ];

  if (input.loopMode === "visual-dev") {
    acceptanceCriteria.push("UI/视觉任务需要启动预览、截图或明确说明缺失的预览条件。");
  }
  if (input.loopMode === "electron-window") {
    acceptanceCriteria.push("Electron 桌面端任务以真窗口验收为准，不能只用网页端结果代替。");
  }

  return {
    projectProfileId: input.profile.id,
    taskKind: input.taskKind,
    loopMode: input.loopMode,
    selectedEntrypoints,
    selectedCommands,
    selectedPreviewTarget,
    guardrails: input.profile.guardrails.slice(0, 8),
    acceptanceCriteria,
    missingContextQuestions: selectedCommands.length === 0 ? ["未识别到可靠验证命令，需要先读取项目文档或询问用户。"] : [],
  };
}

export function applyProjectRuntimeToPrompt(prompt: string, pack: FirstShotContextPack): string {
  if (prompt.includes("## Project Profile")) {
    return prompt;
  }

  const lines = [
    prompt.trim(),
    "",
    "## Project Profile（系统自动加载）",
    "",
    `Profile ID: ${pack.projectProfileId}`,
    `Task Kind: ${pack.taskKind}`,
    `Loop Mode: ${pack.loopMode}`,
    "",
    "## First-Shot Context Pack（项目级上下文）",
    "",
    "Selected Commands:",
    ...(pack.selectedCommands.length > 0
      ? pack.selectedCommands.map((command) => `- ${command.command} (${command.kind})`)
      : ["- 未识别到可靠命令"]),
    "",
    "Preview Target:",
    pack.selectedPreviewTarget
      ? `- ${pack.selectedPreviewTarget.label}${pack.selectedPreviewTarget.url ? `: ${pack.selectedPreviewTarget.url}` : ""}`
      : "- 未识别到预览入口",
    "",
    "Guardrails:",
    ...(pack.guardrails.length > 0 ? pack.guardrails.map((rule) => `- ${rule.rule}`) : ["- 未识别到项目级限制"]),
    "",
    "Acceptance Criteria:",
    ...pack.acceptanceCriteria.map((item) => `- ${item}`),
  ];

  if (pack.selectedEntrypoints.length > 0) {
    lines.push("", "Candidate Entrypoints:", ...pack.selectedEntrypoints.map((entrypoint) => `- ${entrypoint.path} (${entrypoint.kind})`));
  }

  if (pack.missingContextQuestions.length > 0) {
    lines.push("", "Missing Context:", ...pack.missingContextQuestions.map((item) => `- ${item}`));
  }

  return lines.join("\n");
}

export function createProjectRuntimeMessage(
  phase: ProjectRuntimePhase,
  profile: ProjectProfile,
  pack?: FirstShotContextPack,
): ProjectRuntimeMessage {
  const commands = (pack?.selectedCommands ?? profile.commands.slice(0, 4)).map((command) => command.command);
  const guardrails = (pack?.guardrails ?? profile.guardrails.slice(0, 4)).map((guardrail) => guardrail.rule);
  const previewTarget = pack?.selectedPreviewTarget ?? profile.previewTargets[0];

  return {
    type: "project_runtime",
    phase,
    profileId: profile.id,
    cwd: profile.cwd,
    summary: phase === "profile_loaded"
      ? `Project Profile 已加载：${profile.displayName}`
      : `First-Shot Context Pack 已生成：${profile.displayName}`,
    stack: profile.stack.map((item) => item.name),
    commands,
    guardrails,
    previewTarget: previewTarget?.label,
    instructions: pack ? applyProjectRuntimeToPrompt("", pack).trim() : undefined,
  };
}
