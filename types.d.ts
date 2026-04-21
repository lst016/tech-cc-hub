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
    models?: ApiModelConfig[];
    enabled: boolean;
    apiType?: "anthropic";
}

type ApiConfigSettings = {
    profiles: ApiConfig[];
}

type SkillSourceKind = "local" | "remote";

type SkillScope = "single" | "bundle";

type SkillSourceRecord = {
    id: string;
    name: string;
    kind: SkillSourceKind;
    enabled: boolean;
    path: string;
    gitUrl?: string;
    scope?: SkillScope;
    branch?: string;
    lastPulledAt?: number;
    lastCheckedAt?: number;
    checkEveryHours?: number;
    lastKnownCommit?: string;
    lastError?: string;
};

type SkillRegistry = {
    sources: SkillSourceRecord[];
};

type SkillSyncRequest = {
    sourceIds?: string[];
    force?: boolean;
};

type SkillSyncResult = {
    sourceId: string;
    sourceName: string;
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
    "select-directory": string | null;
        "get-api-config": ApiConfigSettings;
        "save-api-config": { success: boolean; error?: string };
        "check-api-config": { hasConfig: boolean; config: ApiConfig | null };
        "get-global-config": GlobalRuntimeConfig;
        "save-global-config": { success: boolean; error?: string };
        "get-skill-registry": SkillRegistry;
        "save-skill-registry": { success: boolean; error?: string };
        "sync-skill-sources": SkillSyncResponse;
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
        selectDirectory: () => Promise<string | null>;
        getApiConfig: () => Promise<ApiConfigSettings>;
        saveApiConfig: (config: ApiConfigSettings) => Promise<{ success: boolean; error?: string }>;
        getGlobalConfig: () => Promise<GlobalRuntimeConfig>;
        saveGlobalConfig: (config: GlobalRuntimeConfig) => Promise<{ success: boolean; error?: string }>;
        getSkillRegistry: () => Promise<SkillRegistry>;
        saveSkillRegistry: (config: SkillRegistry) => Promise<{ success: boolean; error?: string }>;
        syncSkillSources: (request: SkillSyncRequest) => Promise<SkillSyncResponse>;
        checkApiConfig: () => Promise<{ hasConfig: boolean; config: ApiConfig | null }>;
    }
}
