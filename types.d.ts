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

type ApiConfigSettings = {
    profiles: ApiConfig[];
}

type SkillSourceType = "manual" | "git";

type SkillKind = "single" | "bundle";

type InstalledSkillRecord = {
    id: string;
    name: string;
    kind: SkillKind;
    path: string;
    sourceType: SkillSourceType;
    installedAt?: number;
    syncEnabled?: boolean;
    remoteUrl?: string;
    remoteSubpath?: string;
    branch?: string;
    lastPulledAt?: number;
    lastCheckedAt?: number;
    checkEveryHours?: number;
    lastKnownCommit?: string;
    lastError?: string;
};

type SkillInventory = {
    rootPath: string;
    skills: InstalledSkillRecord[];
};

type SkillSyncRequest = {
    skillIds?: string[];
    force?: boolean;
};

type SkillSyncResult = {
    skillId: string;
    skillName: string;
    status: "updated" | "checked" | "skipped" | "error";
    message?: string;
    previousCommit?: string;
    latestCommit?: string;
    checkedAt: number;
};

type SkillSyncResponse = {
    results: SkillSyncResult[];
};

type GlobalRuntimeConfig = Record<string, unknown>;

type RuntimeReasoningMode = "disabled" | "low" | "medium" | "high" | "xhigh";

type UnsubscribeFunction = () => void;

type EventPayloadMapping = {
    statistics: Statistics;
    getStaticData: StaticData;
    "generate-session-title": string;
    "get-recent-cwds": string[];
    "get-system-workspace": string;
    "select-directory": string | null;
        "get-api-config": ApiConfigSettings;
        "save-api-config": { success: boolean; error?: string };
        "check-api-config": { hasConfig: boolean; config: ApiConfig | null };
        "get-global-config": GlobalRuntimeConfig;
        "save-global-config": { success: boolean; error?: string };
        "get-skill-inventory": SkillInventory;
        "save-skill-inventory": { success: boolean; error?: string };
        "sync-skill-sources": SkillSyncResponse;
        "debug-save-trace-snapshot": { success: boolean; path?: string; error?: string };
        "preprocess-image-attachments": ImagePreprocessResult;
}

interface Window {
    electron: {
        subscribeStatistics: (callback: (statistics: Statistics) => void) => UnsubscribeFunction;
        getStaticData: () => Promise<StaticData>;
        // Claude Agent IPC APIs
        sendClientEvent: (event: import("./src/ui/types").ClientEvent) => void;
        onServerEvent: (callback: (event: import("./src/ui/types").ServerEvent) => void) => UnsubscribeFunction;
        generateSessionTitle: (userInput: string | null) => Promise<string>;
        getRecentCwds: (limit?: number) => Promise<string[]>;
        getSystemWorkspace: () => Promise<string>;
        selectDirectory: () => Promise<string | null>;
        getApiConfig: () => Promise<ApiConfigSettings>;
        saveApiConfig: (config: ApiConfigSettings) => Promise<{ success: boolean; error?: string }>;
        getGlobalConfig: () => Promise<GlobalRuntimeConfig>;
        saveGlobalConfig: (config: GlobalRuntimeConfig) => Promise<{ success: boolean; error?: string }>;
        getSkillInventory: () => Promise<SkillInventory>;
        saveSkillInventory: (config: SkillInventory) => Promise<{ success: boolean; error?: string }>;
        syncSkillSources: (request: SkillSyncRequest) => Promise<SkillSyncResponse>;
        checkApiConfig: () => Promise<{ hasConfig: boolean; config: ApiConfig | null }>;
        debugSaveTraceSnapshot: (snapshot: unknown) => Promise<{ success: boolean; path?: string; error?: string }>;
        preprocessImageAttachments: (payload: { prompt: string; attachments: import("./src/ui/types").PromptAttachment[] }) => Promise<ImagePreprocessResult>;
    }
}
