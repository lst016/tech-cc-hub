type Statistics = {
    cpuUsage: number;
    ramUsage: number;
    storageData: number;
}

type StaticData = {
    totalStorage: number;
    cpuModel: string;
    totalMemoryGB: number;
}

  type ApiModelConfig = {
      name: string;
      contextWindow?: number;
      compressionThresholdPercent?: number;
      routingWeight?: number;
      catalogStatus?: "discovered" | "managed" | "excluded";
      alias?: string;
      tags?: string[];
      notes?: string;
      ownedBy?: string;
    supportedEndpointTypes?: string[];
    createdAt?: number;
}

type ApiModelsFetchModel = {
    name: string;
    contextWindow?: number;
    ownedBy?: string;
    supportedEndpointTypes?: string[];
    createdAt?: number;
}

type ApiProviderMode = "custom" | "boke" | "deepseek" | "codex" | "minimax";

type ApiConfig = {
    id: string;
    name: string;
    apiKey: string;
    baseURL: string;
    model: string;
    expertModel?: string;
    imageModel?: string;
    smallModel?: string;
    analysisModel?: string;
    models?: ApiModelConfig[];
    enabled: boolean;
    provider?: ApiProviderMode;
    apiType?: "anthropic";
}

type ImagePreprocessResult = {
    success: boolean;
    attachments: import("./src/ui/types").PromptAttachment[];
    usedImageModel?: string;
    error?: string;
}

type BrowserWorkbenchBounds = {
    x: number;
    y: number;
    width: number;
    height: number;
}

type BrowserWorkbenchState = {
    url: string;
    title?: string;
    loading: boolean;
    canGoBack: boolean;
    canGoForward: boolean;
    annotationMode: boolean;
    error?: string;
}

type BrowserWorkbenchConsoleLog = {
    level: "debug" | "info" | "log" | "warn" | "error";
    message: string;
    timestamp: number;
    url?: string;
    line?: number;
}

type BrowserWorkbenchNetworkLog = {
    id: string;
    url: string;
    method?: string;
    resourceType?: string;
    status?: number;
    statusText?: string;
    mimeType?: string;
    requestHeaders?: Record<string, string>;
    responseHeaders?: Record<string, string>;
    requestPostData?: string;
    requestPostDataPreview?: string;
    requestPostDataTruncated?: boolean;
    responseBody?: string;
    responseBodyPreview?: string;
    responseBodyBase64Encoded?: boolean;
    responseBodyTruncated?: boolean;
    responseJsonFields?: Record<string, string | number | boolean | null>;
    bodyUnavailableReason?: string;
    errorText?: string;
    fromDiskCache?: boolean;
    fromServiceWorker?: boolean;
    startedAt: number;
    finishedAt?: number;
    durationMs?: number;
}

type BrowserWorkbenchHttpRequestInput = {
    method?: string;
    url: string;
    body?: string;
    headers?: Record<string, string>;
    contentType?: string;
    timeoutMs?: number;
}

type BrowserWorkbenchHttpRequestResult = {
    url: string;
    title?: string;
    requestUrl: string;
    method: string;
    status?: number;
    statusText?: string;
    ok?: boolean;
    redirected?: boolean;
    responseUrl?: string;
    responseHeaders?: Record<string, string>;
    responseBody?: string;
    responseBodyPreview?: string;
    responseBodyTruncated?: boolean;
    responseJsonFields?: Record<string, string | number | boolean | null>;
    contentType?: string;
    durationMs: number;
    error?: string;
}

type BrowserWorkbenchNetworkLogInput = {
    limit?: number;
    includeBody?: boolean;
    includeHeaders?: boolean;
    urlContains?: string;
    resourceTypes?: string[];
}

type BrowserWorkbenchNetworkLogResult = {
    url: string;
    title?: string;
    captureEnabled: boolean;
    captureError?: string;
    count: number;
    entries: BrowserWorkbenchNetworkLog[];
}

type BrowserWorkbenchSourceCandidate = {
    component?: string;
    file?: string;
    line?: number;
    column?: number;
    framework?: "react" | "vue" | "class";
    source: "react-debug-source" | "vue-file" | "component-stack" | "class-name";
    confidence: "high" | "medium" | "low";
}

type BrowserWorkbenchDomHint = {
    tagName: string;
    role?: string;
    text?: string;
    ariaLabel?: string;
    selector?: string;
    path?: string;
    xpath?: string;
    hitTagName?: string;
    hitPath?: string;
    hitXPath?: string;
    hitBoundingBox?: { x: number; y: number; width: number; height: number };
    target?: { type: "text"; value: string } | { type: "image"; url: string; alt?: string };
    selectorCandidates: string[];
    boundingBox?: { x: number; y: number; width: number; height: number };
    computedStyle?: Record<string, string>;
    componentStack?: string[];
    sourceCandidates?: BrowserWorkbenchSourceCandidate[];
    componentStackSource?: string;
    componentStackConfidence?: "high" | "medium" | "low";
    context?: {
        ancestorChain?: string[];
        nearbyText?: string;
    };
}

type BrowserWorkbenchAnnotation = {
    id: string;
    url: string;
    title?: string;
    comment?: string;
    expectation?: string;
    styleEdits?: {
        source: string;
        changes: Array<{ property: string; before: string; after: string }>;
    };
    removed?: boolean;
    createdAt: number;
    point: { x: number; y: number };
    domHint?: BrowserWorkbenchDomHint;
}

type BrowserWorkbenchRecordedAction = import("./src/electron/browser-manager").BrowserWorkbenchRecordedAction;
type BrowserWorkbenchRecordingArtifact = import("./src/electron/browser-manager").BrowserWorkbenchRecordingArtifact;
type BrowserWorkbenchRecordingArtifactUpdateResult = import("./src/electron/browser-manager").BrowserWorkbenchRecordingArtifactUpdateResult;
type BrowserWorkbenchRecordingPackage = import("./src/electron/browser-manager").BrowserWorkbenchRecordingPackage;
type BrowserWorkbenchRecordingStatus = import("./src/electron/browser-manager").BrowserWorkbenchRecordingStatus;
type BrowserWorkbenchRecordingResult = import("./src/electron/browser-manager").BrowserWorkbenchRecordingResult;
type BrowserWorkbenchRecordingRunEvent = import("./src/electron/browser-manager").BrowserWorkbenchRecordingRunEvent;
type BrowserWorkbenchRecordingRunResult = import("./src/electron/browser-manager").BrowserWorkbenchRecordingRunResult;
type BrowserWorkbenchRecordingCancelRunResult = import("./src/electron/browser-manager").BrowserWorkbenchRecordingCancelRunResult;
type BrowserWorkbenchRecordingHistoryItem = import("./src/electron/browser-manager").BrowserWorkbenchRecordingHistoryItem;
type BrowserWorkbenchRecordingOpenPathResult = import("./src/electron/browser-manager").BrowserWorkbenchRecordingOpenPathResult;
type BrowserWorkbenchMouseResult = import("./src/electron/browser-manager").BrowserWorkbenchMouseResult;

type BrowserWorkbenchEvent =
    | { type: "browser.open-requested"; payload: { url: string }; sessionId?: string }
    | { type: "browser.state"; payload: BrowserWorkbenchState; sessionId?: string }
    | { type: "browser.console"; payload: BrowserWorkbenchConsoleLog; sessionId?: string }
    | { type: "browser.annotation"; payload: BrowserWorkbenchAnnotation; sessionId?: string }
    | { type: "browser.recording"; payload: BrowserWorkbenchRecordingStatus; sessionId?: string }
    | { type: "browser.recording.package"; payload: BrowserWorkbenchRecordingResult; sessionId?: string }
    | { type: "browser.recording.run"; payload: BrowserWorkbenchRecordingRunEvent; sessionId?: string };

type BrowserWorkbenchCaptureResult = {
    success: boolean;
    dataUrl?: string;
    error?: string;
}

type ApiConfigSettings = {
    profiles: ApiConfig[];
}

type GlobalRuntimeConfig = Record<string, unknown>;

type AgentRuleDocuments = {
    systemDefaultMarkdown: string;
    userClaudeRoot: string;
    userAgentsPath: string;
    userAgentsMarkdown: string;
}

type RuntimeReasoningMode = "disabled" | "low" | "medium" | "high" | "xhigh";

type UnsubscribeFunction = () => void;

type ApiModelsFetchResult = {
    success: boolean;
    models?: ApiModelsFetchModel[];
    baseURL?: string;
    error?: string;
};

type ApiConfigTestResult = {
    success: boolean;
    message?: string;
    endpoint?: string;
    model?: string;
    error?: string;
};

type CodexRuntimeLoginMode = "browser" | "device-code";

type CodexRuntimeLoginStartResult = {
    success: boolean;
    attemptId?: string;
    mode?: CodexRuntimeLoginMode;
    verificationUrl?: string;
    userCode?: string;
    error?: string;
};

type CodexRuntimeLoginEvent = {
    attemptId: string;
    profileId: string;
    type: "opening-browser" | "device-code" | "completed" | "cancelled" | "failed";
    verificationUrl?: string;
    userCode?: string;
    email?: string;
    accountIdSuffix?: string;
    expiresAt?: string;
    error?: string;
};

type AppUpdateStatus = import("./src/ui/types").AppUpdateStatus;
type AppUpdateActionResult = import("./src/ui/types").AppUpdateActionResult;
type UiGitResult<T> = import("./src/ui/types").UiGitResult<T>;
type UiGitWorkbenchSnapshot = import("./src/ui/types").UiGitWorkbenchSnapshot;
type UiGitDiffResult = import("./src/ui/types").UiGitDiffResult;
type UiGitCommitDetail = import("./src/ui/types").UiGitCommitDetail;
type UiGitCommitMessageSuggestion = import("./src/ui/types").UiGitCommitMessageSuggestion;

type EventPayloadMapping = {
    statistics: Statistics;
    getStaticData: StaticData;
    "clipboard:read-image": import("./src/electron/libs/clipboard-image").ClipboardImagePayload | null;
    "techcc-visualization-create-launch": import("./src/shared/techcc-visualization-protocol").TechccVisualizationLaunch;
    "generate-session-title": string;
    "get-recent-cwds": string[];
    "get-system-workspace": string;
    "select-directory": string | null;
        "get-api-config": ApiConfigSettings;
        "save-api-config": { success: boolean; error?: string };
        "fetch-api-models": ApiModelsFetchResult;
        "test-api-config": ApiConfigTestResult;
        "codex-oauth-runtime-start": CodexRuntimeLoginStartResult;
        "codex-oauth-runtime-cancel": { success: boolean; error?: string };
        "app-update-get-status": AppUpdateStatus;
        "app-update-check": AppUpdateActionResult;
        "app-update-download": AppUpdateActionResult;
        "app-update-install": AppUpdateActionResult;
        "check-api-config": { hasConfig: boolean; config: ApiConfig | null };
        "get-global-config": GlobalRuntimeConfig;
        "save-global-config": { success: boolean; error?: string };
        "get-agent-rule-documents": AgentRuleDocuments;
        "save-user-agent-rule-document": { success: boolean; error?: string };
        "debug-save-trace-snapshot": { success: boolean; path?: string; error?: string };
        "preprocess-image-attachments": ImagePreprocessResult;
        "plugin-platform:list": import("./src/electron/libs/plugin-platform/plugin-package-registry").PluginPackageCatalog;
        "workspace-plugins:list": import("./src/shared/workspace-plugins").WorkspacePluginDescriptor[];
        "workspace-plugins:open": import("./src/electron/libs/workspace-plugins/workspace-plugin-manager").WorkspacePluginLaunch;
        "workspace-plugins:close": void;
        "browser-open": BrowserWorkbenchState;
        "browser-close": BrowserWorkbenchState;
        "browser-set-bounds": BrowserWorkbenchState;
        "browser-hide-all": BrowserWorkbenchState[];
        "browser-reload": BrowserWorkbenchState;
        "browser-back": BrowserWorkbenchState;
        "browser-forward": BrowserWorkbenchState;
        "browser-state": BrowserWorkbenchState;
        "browser-console-logs": BrowserWorkbenchConsoleLog[];
        "browser-fetch-logs": { success: boolean; result?: BrowserWorkbenchNetworkLogResult; error?: string };
        "browser-capture-visible": BrowserWorkbenchCaptureResult;
        "browser-inspect-at-point": BrowserWorkbenchDomHint | null;
        "browser-click-at-point": BrowserWorkbenchMouseResult;
        "browser-clear-annotations": BrowserWorkbenchState;
        "browser-remove-annotation": BrowserWorkbenchState;
        "browser-annotation-mode": BrowserWorkbenchState;
        "browser-open-devtools": { opened: boolean };
        "browser-close-devtools": { opened: boolean };
        "browser-is-devtools-open": boolean;
        "browser-recording-start": BrowserWorkbenchRecordingResult;
        "browser-recording-stop": BrowserWorkbenchRecordingResult;
        "browser-recording-state": BrowserWorkbenchRecordingStatus;
        "browser-recording-assertion-mode": BrowserWorkbenchRecordingStatus;
        "browser-recording-run": BrowserWorkbenchRecordingRunResult;
        "browser-recording-run-cancel": BrowserWorkbenchRecordingCancelRunResult;
        "browser-recording-open-run-output": BrowserWorkbenchRecordingOpenPathResult;
        "browser-recording-open-trace-viewer": BrowserWorkbenchRecordingOpenPathResult;
        "browser-recording-history": BrowserWorkbenchRecordingHistoryItem[];
        "browser-recording-load-history": BrowserWorkbenchRecordingResult;
        "browser-recording-update-artifact": BrowserWorkbenchRecordingArtifactUpdateResult;
        "browser-recording-locator-pick-start": BrowserWorkbenchRecordingStatus;
        "browser-recording-locator-pick-cancel": BrowserWorkbenchRecordingStatus;
        "browser-recording-add-assertion": BrowserWorkbenchRecordingResult;
        "browser-recording-repair-locator": BrowserWorkbenchRecordingResult;
        "git:snapshot": UiGitResult<UiGitWorkbenchSnapshot>;
        "git:diff": UiGitResult<UiGitDiffResult>;
        "git:commitDetail": UiGitResult<UiGitCommitDetail>;
        "git:stage": UiGitResult<UiGitWorkbenchSnapshot>;
        "git:unstage": UiGitResult<UiGitWorkbenchSnapshot>;
        "git:commit": UiGitResult<UiGitWorkbenchSnapshot>;
        "git:generateCommitMessageFast": UiGitResult<UiGitCommitMessageSuggestion>;
        "git:generateCommitMessage": UiGitResult<UiGitCommitMessageSuggestion>;
        "git:pull": UiGitResult<UiGitWorkbenchSnapshot>;
        "git:push": UiGitResult<UiGitWorkbenchSnapshot>;
        "git:createBranch": UiGitResult<UiGitWorkbenchSnapshot>;
        "git:checkoutBranch": UiGitResult<UiGitWorkbenchSnapshot>;
        "git:stashSave": UiGitResult<UiGitWorkbenchSnapshot>;
        "git:stashApply": UiGitResult<UiGitWorkbenchSnapshot>;
        "git:stashDrop": UiGitResult<UiGitWorkbenchSnapshot>;
        "feedback:capture-screenshot": string | null;
        "feedback:submit-issue": FeedbackSubmitResult;
}

type FeedbackSubmitResult = { success: boolean; issueUrl?: string; error?: string; fallback?: boolean; message?: string };

interface Window {
    electron: {
        platform: string;
        subscribeStatistics: (callback: (statistics: Statistics) => void) => UnsubscribeFunction;
        getStaticData: () => Promise<StaticData>;
        // Claude Agent IPC APIs
        sendClientEvent: (event: import("./src/ui/types").ClientEvent) => void;
        onServerEvent: (callback: (event: import("./src/ui/types").ServerEvent) => void) => UnsubscribeFunction;
        generateSessionTitle: (userInput: string | null, options?: { model?: string }) => Promise<string>;
        getRecentCwds: (limit?: number) => Promise<string[]>;
        getSystemWorkspace: () => Promise<string>;
        selectDirectory: () => Promise<string | null>;
        getApiConfig: () => Promise<ApiConfigSettings>;
        saveApiConfig: (config: ApiConfigSettings) => Promise<{ success: boolean; error?: string }>;
        fetchApiModels: (payload: { baseURL: string; apiKey: string; provider?: ApiProviderMode }) => Promise<ApiModelsFetchResult>;
        testApiConfig: (payload: { profileId?: string; baseURL: string; apiKey: string; model: string; provider?: ApiProviderMode }) => Promise<ApiConfigTestResult>;
        startCodexOAuthRuntime: (payload: { profile: ApiConfig; mode?: CodexRuntimeLoginMode }) => Promise<CodexRuntimeLoginStartResult>;
        cancelCodexOAuthRuntime: (attemptId: string) => Promise<{ success: boolean; error?: string }>;
        onCodexOAuthRuntimeEvent: (callback: (event: CodexRuntimeLoginEvent) => void) => UnsubscribeFunction;
        getAppUpdateStatus: () => Promise<AppUpdateStatus>;
        checkForAppUpdates: () => Promise<AppUpdateActionResult>;
        downloadAppUpdate: () => Promise<AppUpdateActionResult>;
        installAppUpdate: () => Promise<AppUpdateActionResult>;
        onAppUpdateStatus: (callback: (status: AppUpdateStatus) => void) => UnsubscribeFunction;
        getGlobalConfig: () => Promise<GlobalRuntimeConfig>;
        saveGlobalConfig: (config: GlobalRuntimeConfig) => Promise<{ success: boolean; error?: string }>;
        getAgentRuleDocuments: () => Promise<AgentRuleDocuments>;
        saveUserAgentRuleDocument: (markdown: string) => Promise<{ success: boolean; error?: string }>;
        invoke: <T = unknown>(channel: string, ...args: unknown[]) => Promise<T>;
        checkApiConfig: () => Promise<{ hasConfig: boolean; config: ApiConfig | null }>;
        debugSaveTraceSnapshot: (snapshot: unknown) => Promise<{ success: boolean; path?: string; error?: string }>;
        preprocessImageAttachments: (payload: { prompt: string; selectedModel?: string; attachments: import("./src/ui/types").PromptAttachment[] }) => Promise<ImagePreprocessResult>;
        getGitSnapshot: (payload: { cwd: string }) => Promise<UiGitResult<UiGitWorkbenchSnapshot>>;
        getGitDiff: (payload: { cwd: string; path: string; staged?: boolean }) => Promise<UiGitResult<UiGitDiffResult>>;
        getGitCommitDetail: (payload: { cwd: string; hash: string }) => Promise<UiGitResult<UiGitCommitDetail>>;
        gitStageFiles: (payload: { cwd: string; paths: string[] }) => Promise<UiGitResult<UiGitWorkbenchSnapshot>>;
        gitUnstageFiles: (payload: { cwd: string; paths: string[] }) => Promise<UiGitResult<UiGitWorkbenchSnapshot>>;
        gitCommit: (payload: { cwd: string; message: string; body?: string }) => Promise<UiGitResult<UiGitWorkbenchSnapshot>>;
        generateGitCommitMessageFast: (payload: { cwd: string; language?: string }) => Promise<UiGitResult<UiGitCommitMessageSuggestion>>;
        generateGitCommitMessage: (payload: { cwd: string; language?: string }) => Promise<UiGitResult<UiGitCommitMessageSuggestion>>;
        gitPull: (payload: { cwd: string }) => Promise<UiGitResult<UiGitWorkbenchSnapshot>>;
        gitPush: (payload: { cwd: string }) => Promise<UiGitResult<UiGitWorkbenchSnapshot>>;
        gitCreateBranch: (payload: { cwd: string; name: string; checkout?: boolean }) => Promise<UiGitResult<UiGitWorkbenchSnapshot>>;
        gitCheckoutBranch: (payload: { cwd: string; name: string }) => Promise<UiGitResult<UiGitWorkbenchSnapshot>>;
        gitStashSave: (payload: { cwd: string; message?: string }) => Promise<UiGitResult<UiGitWorkbenchSnapshot>>;
        gitStashApply: (payload: { cwd: string; ref: string }) => Promise<UiGitResult<UiGitWorkbenchSnapshot>>;
        gitStashDrop: (payload: { cwd: string; ref: string }) => Promise<UiGitResult<UiGitWorkbenchSnapshot>>;
        readPreviewFile: (payload: { cwd: string; path: string }) => Promise<{ success: boolean; path?: string; content?: string; language?: string; error?: string }>;
        listPreviewDirectory: (payload: { cwd: string; path?: string }) => Promise<{ success: boolean; path?: string; entries?: Array<{ name: string; path: string; relativePath: string; type: "directory" | "file"; size?: number }>; error?: string }>;
        listPreviewFiles: (payload: { cwd: string; limit?: number }) => Promise<{ success: boolean; entries?: Array<{ name: string; path: string; relativePath: string; type: "file"; size?: number }>; truncated?: boolean; error?: string }>;
        searchLarkContacts: (query: string) => Promise<Array<{ openId: string; name: string; department?: string }>>;
        searchLarkShareChats: (query: string) => Promise<Array<{ kind: "chat"; id: string; name: string; detail?: string; avatarUrl?: string }>>;
        searchLarkShareRecipients: (query: string) => Promise<Array<{ kind: "user" | "chat"; id: string; name: string; detail?: string; avatarUrl?: string }>>;
        sendLarkShareMessage: (input: { recipient: { kind: "user" | "chat"; id: string; name: string; detail?: string; avatarUrl?: string }; text: string }) => Promise<{ messageId?: string; chatId?: string }>;
        getPreviewImageBase64: (payload: { cwd: string; path: string }) => Promise<{ success: boolean; path?: string; content?: string; error?: string }>;
        getPreviewFileMetadata: (payload: { cwd: string; path: string }) => Promise<{ name: string; path: string; size: number; type: string; lastModified: number; isDirectory?: boolean } | null>;
        writePreviewFile: (payload: { cwd: string; path: string; data: string }) => Promise<{ success: boolean; path?: string; error?: string }>;
        removePreviewEntry: (payload: { cwd: string; path: string }) => Promise<{ success: boolean; path?: string; error?: string }>;
        renamePreviewEntry: (payload: { cwd: string; path: string; newName: string }) => Promise<{ success: boolean; path?: string; newPath?: string; error?: string }>;
        openPreviewFile: (payload: { path: string }) => Promise<{ success: boolean; error?: string }>;
        showPreviewItemInFolder: (payload: { path: string }) => Promise<{ success: boolean; error?: string }>;
        openPreviewDirectoryDialog: (payload: { properties?: string[] }) => Promise<string[]>;
        pluginPlatform: {
            list: () => Promise<import("./src/electron/libs/plugin-platform/plugin-package-registry").PluginPackageCatalog>;
        };
        workspacePlugins: {
            list: () => Promise<import("./src/shared/workspace-plugins").WorkspacePluginDescriptor[]>;
            open: (input: { pluginId: string; sessionId: string }) => Promise<import("./src/electron/libs/workspace-plugins/workspace-plugin-manager").WorkspacePluginLaunch>;
            close: (input: { pluginId: string; sessionId: string }) => Promise<void>;
        };
        openBrowserWorkbench: (url: string, sessionId?: string) => Promise<BrowserWorkbenchState>;
        closeBrowserWorkbench: (sessionId?: string) => Promise<BrowserWorkbenchState>;
        setBrowserWorkbenchBounds: (bounds: BrowserWorkbenchBounds, sessionId?: string) => Promise<BrowserWorkbenchState>;
        hideAllBrowserWorkbenches: () => Promise<BrowserWorkbenchState[]>;
        reloadBrowserWorkbench: (sessionId?: string) => Promise<BrowserWorkbenchState>;
        goBackBrowserWorkbench: (sessionId?: string) => Promise<BrowserWorkbenchState>;
        goForwardBrowserWorkbench: (sessionId?: string) => Promise<BrowserWorkbenchState>;
        getBrowserWorkbenchState: (sessionId?: string) => Promise<BrowserWorkbenchState>;
        getBrowserWorkbenchConsoleLogs: (limit?: number, sessionId?: string) => Promise<BrowserWorkbenchConsoleLog[]>;
        getBrowserWorkbenchFetchLogs: (input?: BrowserWorkbenchNetworkLogInput, sessionId?: string) => Promise<{ success: boolean; result?: BrowserWorkbenchNetworkLogResult; error?: string }>;
        captureBrowserWorkbenchVisible: (sessionId?: string) => Promise<BrowserWorkbenchCaptureResult>;
        inspectBrowserWorkbenchAtPoint: (point: { x: number; y: number }, sessionId?: string) => Promise<BrowserWorkbenchDomHint | null>;
        clickBrowserWorkbenchAtPoint: (point: { x: number; y: number; dblClick?: boolean }, sessionId?: string) => Promise<BrowserWorkbenchMouseResult>;
        clearBrowserWorkbenchAnnotations: (sessionId?: string) => Promise<BrowserWorkbenchState>;
        removeBrowserWorkbenchAnnotation: (annotationId: string, sessionId?: string) => Promise<BrowserWorkbenchState>;
        setBrowserWorkbenchAnnotationMode: (enabled: boolean, sessionId?: string) => Promise<BrowserWorkbenchState>;
        openBrowserWorkbenchDevTools: (sessionId?: string) => Promise<{ opened: boolean }>;
        closeBrowserWorkbenchDevTools: (sessionId?: string) => Promise<{ opened: boolean }>;
        isBrowserWorkbenchDevToolsOpen: (sessionId?: string) => Promise<boolean>;
        startBrowserWorkbenchRecording: (sessionId?: string) => Promise<BrowserWorkbenchRecordingResult>;
        stopBrowserWorkbenchRecording: (sessionId?: string) => Promise<BrowserWorkbenchRecordingResult>;
        getBrowserWorkbenchRecordingState: (sessionId?: string) => Promise<BrowserWorkbenchRecordingStatus>;
        setBrowserWorkbenchRecordingAssertionMode: (enabled: boolean, sessionId?: string) => Promise<BrowserWorkbenchRecordingStatus>;
        runBrowserWorkbenchRecording: (sessionId?: string) => Promise<BrowserWorkbenchRecordingRunResult>;
        cancelBrowserWorkbenchRecordingRun: (sessionId?: string) => Promise<BrowserWorkbenchRecordingCancelRunResult>;
        openBrowserWorkbenchRecordingRunOutput: (sessionId?: string) => Promise<BrowserWorkbenchRecordingOpenPathResult>;
        openBrowserWorkbenchRecordingTraceViewer: (sessionId?: string) => Promise<BrowserWorkbenchRecordingOpenPathResult>;
        listBrowserWorkbenchRecordings: (sessionId?: string, limit?: number) => Promise<BrowserWorkbenchRecordingHistoryItem[]>;
        loadBrowserWorkbenchRecording: (rootPath: string, sessionId?: string) => Promise<BrowserWorkbenchRecordingResult>;
        updateBrowserWorkbenchRecordingArtifact: (artifactPath: string, content: string, sessionId?: string) => Promise<BrowserWorkbenchRecordingArtifactUpdateResult>;
        startBrowserWorkbenchRecordingLocatorPick: (actionId: string, sessionId?: string) => Promise<BrowserWorkbenchRecordingStatus>;
        cancelBrowserWorkbenchRecordingLocatorPick: (sessionId?: string) => Promise<BrowserWorkbenchRecordingStatus>;
        addBrowserWorkbenchRecordingAssertion: (input: { kind: BrowserWorkbenchRecordedAction["kind"]; value?: string; key?: string; selector?: string }, sessionId?: string) => Promise<BrowserWorkbenchRecordingResult>;
        repairBrowserWorkbenchRecordingLocator: (actionId: string, selector: string, sessionId?: string) => Promise<BrowserWorkbenchRecordingResult>;
        onBrowserWorkbenchEvent: (callback: (event: BrowserWorkbenchEvent) => void) => UnsubscribeFunction;
        onCronJobCreated: (callback: (job: import("./src/types/cron").CronJob) => void) => UnsubscribeFunction;
        onCronJobUpdated: (callback: (job: import("./src/types/cron").CronJob) => void) => UnsubscribeFunction;
        onCronJobRemoved: (callback: (data: { jobId: string }) => void) => UnsubscribeFunction;
        onCronJobExecuted: (callback: (data: { jobId: string; status: "ok" | "error" | "skipped" | "missed"; error?: string }) => void) => UnsubscribeFunction;
        captureScreenshot: () => Promise<string | null>;
        submitFeedback: (payload: { body: string; images?: Array<{ dataUrl: string; name: string }> }) => Promise<FeedbackSubmitResult>;
    }
}
