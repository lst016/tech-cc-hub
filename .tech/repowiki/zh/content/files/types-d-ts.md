# types.d.ts

> 模块：`root` · 语言：`typescript` · 行数：312

## 文件职责

全局类型定义，包含 API 配置、浏览器工作台状态、任务系统等核心类型

## 关键符号

- `ApiConfig@0 - API 网关配置，包含 id、name、baseURL、model、各类模型槽位设置`
- `BrowserWorkbenchState@0 - 浏览器工作台状态，包含 url、loading、canGoBack、annotationMode 等`
- `BrowserWorkbenchAnnotation@0 - 浏览器标注对象，包含位置、DOM 提示、评论、期望等`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
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

type ApiProviderMode = "custom" | "deepseek" | "codex";

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
}

type BrowserWorkbenchConsoleLog = {
    level: "debug" | "info" | "log" | "warn" | "error";
    message: string;
    timestamp: number;
    url?: string;
    line?: number;
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
    target?: { type: "text"; value: string } | { type: "image"; url: string; alt?: string };
    selectorCandidates: string[];
    boundingBox?: { x: number; y: number; width: number; height: number };
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

type ApiConfigTestResult = {
    success: boolean;
    message?: string;
    endpoint?: string;
    model?: string;
    error?: string;
};

type CodexOAuthResult = {
    success: boolean;
    authorizeUrl?: string;
    credential?: string;
    accountId?: string;
    email?: string;
    expiresAt?: string;
    error?: string;
};

type AppUpdateStatus = import("./src/ui/types").AppUpdateStatus;
type AppUpdateActionResult = import("./src/ui/types").AppUpdateActionResult;
type UiGitResult<T> = import("./src/ui/types").UiGitResult<T>;
type UiGitWorkbenchSnapshot = import("./src/ui/types").UiGitWorkbenchSnapshot;
type UiGitDiffResult = import("./src/ui/types").UiGitDiffResult;
type UiGitCommitDetail = import("./src/ui/types").UiGitCommitDetail;
type UiGitCommitMe
... (truncated)
```
