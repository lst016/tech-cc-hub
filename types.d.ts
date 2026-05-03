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
}

type ApiConfig = {
    id: string;
    name: string;
    apiKey: string;
    baseURL: string;
    model: string;
    expertModel?: string;
    imageModel?: string;
    models?: ApiModelConfig[];
    enabled: boolean;
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
}

type BrowserWorkbenchConsoleLog = {
    level: "debug" | "info" | "log" | "warn" | "error";
    message: string;
    timestamp: number;
    url?: string;
    line?: number;
}

type BrowserWorkbenchDomHint = {
    tagName: string;
    role?: string;
    text?: string;
    ariaLabel?: string;
    selector?: string;
    path?: string;
    xpath?: string;
    target?: { type: "text"; value: string } | { type: "image"; url: string; alt?: string };
    selectorCandidates: string[];
    boundingBox?: { x: number; y: number; width: number; height: number };
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
    removed?: boolean;
    createdAt: number;
    point: { x: number; y: number };
    domHint?: BrowserWorkbenchDomHint;
}

type BrowserWorkbenchEvent =
    | { type: "browser.state"; payload: BrowserWorkbenchState; sessionId?: string }
    | { type: "browser.console"; payload: BrowserWorkbenchConsoleLog; sessionId?: string }
    | { type: "browser.annotation"; payload: BrowserWorkbenchAnnotation; sessionId?: string };

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
    models?: string[];
    baseURL?: string;
    error?: string;
};

type AppUpdateStatus = import("./src/ui/types").AppUpdateStatus;
type AppUpdateActionResult = import("./src/ui/types").AppUpdateActionResult;

type EventPayloadMapping = {
    statistics: Statistics;
    getStaticData: StaticData;
    "generate-session-title": string;
    "get-recent-cwds": string[];
    "get-system-workspace": string;
    "select-directory": string | null;
        "get-api-config": ApiConfigSettings;
        "save-api-config": { success: boolean; error?: string };
        "fetch-api-models": ApiModelsFetchResult;
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
        "browser-open": BrowserWorkbenchState;
        "browser-close": BrowserWorkbenchState;
        "browser-set-bounds": BrowserWorkbenchState;
        "browser-reload": BrowserWorkbenchState;
        "browser-back": BrowserWorkbenchState;
        "browser-forward": BrowserWorkbenchState;
        "browser-state": BrowserWorkbenchState;
        "browser-console-logs": BrowserWorkbenchConsoleLog[];
        "browser-capture-visible": BrowserWorkbenchCaptureResult;
        "browser-inspect-at-point": BrowserWorkbenchDomHint | null;
        "browser-clear-annotations": BrowserWorkbenchState;
        "browser-annotation-mode": BrowserWorkbenchState;
        "browser-open-devtools": { opened: boolean };
        "browser-close-devtools": { opened: boolean };
        "browser-is-devtools-open": boolean;
}

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
        fetchApiModels: (payload: { baseURL: string; apiKey: string }) => Promise<ApiModelsFetchResult>;
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
        readPreviewFile: (payload: { cwd: string; path: string }) => Promise<{ success: boolean; path?: string; content?: string; language?: string; error?: string }>;
        listPreviewDirectory: (payload: { cwd: string; path?: string }) => Promise<{ success: boolean; path?: string; entries?: Array<{ name: string; path: string; relativePath: string; type: "directory" | "file"; size?: number }>; error?: string }>;
        getPreviewImageBase64: (payload: { cwd: string; path: string }) => Promise<{ success: boolean; path?: string; content?: string; error?: string }>;
        getPreviewFileMetadata: (payload: { cwd: string; path: string }) => Promise<{ name: string; path: string; size: number; type: string; lastModified: number; isDirectory?: boolean } | null>;
        writePreviewFile: (payload: { cwd: string; path: string; data: string }) => Promise<{ success: boolean; path?: string; error?: string }>;
        removePreviewEntry: (payload: { cwd: string; path: string }) => Promise<{ success: boolean; path?: string; error?: string }>;
        renamePreviewEntry: (payload: { cwd: string; path: string; newName: string }) => Promise<{ success: boolean; path?: string; newPath?: string; error?: string }>;
        openPreviewFile: (payload: { path: string }) => Promise<{ success: boolean; error?: string }>;
        showPreviewItemInFolder: (payload: { path: string }) => Promise<{ success: boolean; error?: string }>;
        openPreviewDirectoryDialog: (payload: { properties?: string[] }) => Promise<string[]>;
        openBrowserWorkbench: (url: string, sessionId?: string) => Promise<BrowserWorkbenchState>;
        closeBrowserWorkbench: (sessionId?: string) => Promise<BrowserWorkbenchState>;
        setBrowserWorkbenchBounds: (bounds: BrowserWorkbenchBounds, sessionId?: string) => Promise<BrowserWorkbenchState>;
        reloadBrowserWorkbench: (sessionId?: string) => Promise<BrowserWorkbenchState>;
        goBackBrowserWorkbench: (sessionId?: string) => Promise<BrowserWorkbenchState>;
        goForwardBrowserWorkbench: (sessionId?: string) => Promise<BrowserWorkbenchState>;
        getBrowserWorkbenchState: (sessionId?: string) => Promise<BrowserWorkbenchState>;
        getBrowserWorkbenchConsoleLogs: (limit?: number, sessionId?: string) => Promise<BrowserWorkbenchConsoleLog[]>;
        captureBrowserWorkbenchVisible: (sessionId?: string) => Promise<BrowserWorkbenchCaptureResult>;
        inspectBrowserWorkbenchAtPoint: (point: { x: number; y: number }, sessionId?: string) => Promise<BrowserWorkbenchDomHint | null>;
        clearBrowserWorkbenchAnnotations: (sessionId?: string) => Promise<BrowserWorkbenchState>;
        setBrowserWorkbenchAnnotationMode: (enabled: boolean, sessionId?: string) => Promise<BrowserWorkbenchState>;
        openBrowserWorkbenchDevTools: (sessionId?: string) => Promise<{ opened: boolean }>;
        closeBrowserWorkbenchDevTools: (sessionId?: string) => Promise<{ opened: boolean }>;
        isBrowserWorkbenchDevToolsOpen: (sessionId?: string) => Promise<boolean>;
        onBrowserWorkbenchEvent: (callback: (event: BrowserWorkbenchEvent) => void) => UnsubscribeFunction;
    }
}
