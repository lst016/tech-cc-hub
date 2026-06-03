export type BrowserWorkbenchRecordingActionKind =
  | "click"
  | "fill"
  | "select"
  | "check"
  | "uncheck"
  | "press"
  | "scroll"
  | "navigate"
  | "assertVisible"
  | "assertText"
  | "assertUrl"
  | "assertTitle"
  | "assertCount"
  | "assertAttribute"
  | "assertScreenshot"
  | "assertResponse";

export type BrowserWorkbenchRecordingTarget = {
  selector?: string;
  role?: string;
  name?: string;
  text?: string;
  tagName?: string;
  inputType?: string;
};

export type BrowserWorkbenchRecordedAction = {
  id: string;
  kind: BrowserWorkbenchRecordingActionKind;
  timestamp: number;
  url: string;
  title?: string;
  target?: BrowserWorkbenchRecordingTarget;
  value?: string;
  key?: string;
  checked?: boolean;
  scrollX?: number;
  scrollY?: number;
  source?: "page" | "navigation";
};

export type BrowserWorkbenchRecordingViewport = {
  width: number;
  height: number;
};

export type BrowserWorkbenchRecordingSource = {
  url: string;
  title?: string;
  viewport?: BrowserWorkbenchRecordingViewport;
};

export type BrowserWorkbenchRecordingSession = {
  id: string;
  startedAt: number;
  startUrl: string;
  startTitle?: string;
  viewport?: BrowserWorkbenchRecordingViewport;
  actions: BrowserWorkbenchRecordedAction[];
};

export type BrowserWorkbenchRecordingStatus = {
  recording: boolean;
  id?: string;
  startedAt?: number;
  url?: string;
  title?: string;
  actionCount: number;
  assertionMode?: boolean;
  locatorPickActionId?: string;
};

export type BrowserWorkbenchRecordingStartInput = {
  url: string;
  title?: string;
  viewport?: BrowserWorkbenchRecordingViewport;
};

export type BrowserWorkbenchRecordingLocatorCandidate = {
  actionId: string;
  strategy: "testId" | "role" | "label" | "placeholder" | "text" | "css";
  value: string;
  unique?: boolean;
  stable?: boolean;
  reason?: string;
};

export type BrowserWorkbenchRecordingEvidence = {
  screenshots: Array<{ id: string; path?: string; actionId?: string; timestamp: number }>;
  snapshots: Array<{ id: string; kind: "dom" | "accessibility"; path?: string; actionId?: string; timestamp: number }>;
  network: Array<{ id: string; url: string; method?: string; status?: number; actionId?: string; timestamp: number }>;
  console: Array<{ id: string; level: string; message: string; actionId?: string; timestamp: number }>;
};

export type BrowserWorkbenchRecordingEnvironment = {
  baseURL: string;
  startPath: string;
  viewport?: BrowserWorkbenchRecordingViewport;
  browserName: "chromium" | "firefox" | "webkit";
  headless: boolean;
  storageStatePath?: string;
  trace: "on" | "off" | "retain-on-failure";
  screenshot: "on" | "off" | "only-on-failure";
  video: "on" | "off" | "retain-on-failure";
};

export type BrowserWorkbenchRecordingDataScenario = {
  name: string;
  data: Record<string, string>;
};

export type BrowserWorkbenchRecordingSuite = {
  id: string;
  name: string;
  tags: string[];
  retries: number;
  workers: number;
  projects: Array<BrowserWorkbenchRecordingEnvironment["browserName"]>;
};

export type BrowserWorkbenchRecordingDiagnosticSeverity = "info" | "warning" | "error";

export type BrowserWorkbenchRecordingDiagnostic = {
  id: string;
  type:
    | "fragile-selector"
    | "missing-assertion"
    | "hard-coded-data"
    | "navigation-race"
    | "network-evidence"
    | "action-volume";
  severity: BrowserWorkbenchRecordingDiagnosticSeverity;
  actionId?: string;
  message: string;
  suggestion?: string;
};

export type BrowserWorkbenchRecordingDocument = {
  schemaVersion: 1;
  id: string;
  createdAt: number;
  startedAt: number;
  completedAt: number;
  source: BrowserWorkbenchRecordingSource;
  capabilities: {
    rawActions: true;
    locatorCandidates: boolean;
    assertions: boolean;
    replay: boolean;
    repairLoop: boolean;
    runEvents?: boolean;
    traceViewer?: boolean;
    scriptEditing?: boolean;
    suites?: boolean;
    parameterizedEnvironment?: boolean;
    dataDriven?: boolean;
    diagnostics?: boolean;
    expandedAssertions?: boolean;
  };
  environment: BrowserWorkbenchRecordingEnvironment;
  dataScenarios: BrowserWorkbenchRecordingDataScenario[];
  suite: BrowserWorkbenchRecordingSuite;
  diagnostics: BrowserWorkbenchRecordingDiagnostic[];
  actions: BrowserWorkbenchRecordedAction[];
  locatorCandidates: BrowserWorkbenchRecordingLocatorCandidate[];
  evidence: BrowserWorkbenchRecordingEvidence;
};

export type BrowserWorkbenchRecordingArtifactKind =
  | "recording"
  | "environment"
  | "data"
  | "page"
  | "flow"
  | "fixture"
  | "spec"
  | "suite"
  | "diagnostics"
  | "manifest"
  | "readme";

export type BrowserWorkbenchRecordingArtifact = {
  kind: BrowserWorkbenchRecordingArtifactKind;
  path: string;
  content: string;
  language?: string;
};

export type BrowserWorkbenchRecordingPackage = {
  id: string;
  createdAt: number;
  rootPathHint: string;
  recordingPath: string;
  generatedSpecPath: string;
  recording: BrowserWorkbenchRecordingDocument;
  environment: BrowserWorkbenchRecordingEnvironment;
  dataScenarios: BrowserWorkbenchRecordingDataScenario[];
  suite: BrowserWorkbenchRecordingSuite;
  diagnostics: BrowserWorkbenchRecordingDiagnostic[];
  artifacts: BrowserWorkbenchRecordingArtifact[];
};

export type BrowserWorkbenchRecordingResult = BrowserWorkbenchRecordingStatus & {
  success: boolean;
  script?: string;
  fileName?: string;
  recordingJson?: string;
  recordingPackage?: BrowserWorkbenchRecordingPackage;
  savedRootPath?: string;
  saveError?: string;
  actions?: BrowserWorkbenchRecordedAction[];
  error?: string;
};

export type BrowserWorkbenchRecordingRunStatus = "passed" | "failed" | "error" | "timed-out" | "cancelled";

export type BrowserWorkbenchRecordingRunEventType = "started" | "stdout" | "stderr" | "finished" | "error";

export type BrowserWorkbenchRecordingRunEvent = {
  id: string;
  type: BrowserWorkbenchRecordingRunEventType;
  timestamp: number;
  sequence: number;
  recordingId: string;
  message?: string;
  status?: BrowserWorkbenchRecordingRunStatus;
};

export type BrowserWorkbenchRecordingRunAttachments = {
  traceFiles: string[];
  screenshotFiles: string[];
  videoFiles: string[];
  otherFiles: string[];
};

export type BrowserWorkbenchRecordingRunResult = {
  success: boolean;
  status: BrowserWorkbenchRecordingRunStatus;
  recordingId: string;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  workspaceRoot: string;
  rootPath: string;
  specPath: string;
  outputDir: string;
  command: string;
  args: string[];
  exitCode?: number;
  signal?: string;
  stdout: string;
  stderr: string;
  events: BrowserWorkbenchRecordingRunEvent[];
  attachments: BrowserWorkbenchRecordingRunAttachments;
  traceViewerCommand?: string;
  error?: string;
};

export type BrowserWorkbenchRecordingHistoryItem = {
  id: string;
  rootPath: string;
  sourceUrl?: string;
  actionCount?: number;
  generatedAt?: number;
  generatedSpecPath?: string;
  suiteName?: string;
  tags?: string[];
};

export type BrowserWorkbenchRecordingOpenPathResult = {
  success: boolean;
  path?: string;
  error?: string;
};

export type BrowserWorkbenchRecordingCancelRunResult = {
  success: boolean;
  error?: string;
};

export type BrowserWorkbenchRecordingArtifactUpdateInput = {
  workspaceRoot: string;
  recordingPackage: BrowserWorkbenchRecordingPackage;
  artifactPath: string;
  content: string;
};

export type BrowserWorkbenchRecordingArtifactUpdateResult = {
  success: boolean;
  recordingPackage: BrowserWorkbenchRecordingPackage;
  artifactPath: string;
  filePath?: string;
  error?: string;
};
