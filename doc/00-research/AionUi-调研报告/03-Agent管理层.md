# AionUi 调研报告 - Agent 管理层

**模块**: `src/process/agent/`
**调研时间**: 2026-05-01

---

## 一、模块结构

```
agent/
├── AgentRegistry.ts       # Agent 注册表核心
├── types.ts              # 类型导出
├── acp/                   # ACP 协议检测
├── aionrs/               # Aion CLI
├── gemini/               # Gemini
├── nanobot/             # Nanobot
├── openclaw/            # OpenClaw
└── remote/              # 远程 Agent
```

---

## 二、Agent 检测类型系统

### 2.1 detectedAgent.ts

```typescript
// 执行引擎类型
export type DetectedAgentKind = 
  | 'gemini' 
  | 'acp' 
  | 'remote' 
  | 'aionrs' 
  | 'openclaw-gateway' 
  | 'nanobot';

// Kind 特定字段映射
type KindFields = {
  gemini: {};  // Gemini 无需 CLI 检测，始终可用

  acp: {
    cliPath?: string;          // 解析后的 CLI 路径
    acpArgs?: string[];       // 额外参数
    isExtension?: boolean;    // 扩展贡献
    extensionName?: string;   // 扩展名称
    customAgentId?: string;   // 自定义 Agent ID
  };

  remote: {
    remoteAgentId: string;    // 远程配置 ID
    url: string;              // WebSocket URL
    protocol: RemoteAgentProtocol;
    authType: RemoteAgentAuthType;
  };

  aionrs: {
    cliPath?: string;
    version?: string;
  };

  'openclaw-gateway': {
    cliPath?: string;
    gatewayUrl?: string;
  };

  nanobot: {
    cliPath?: string;
  };
};

// 通用 DetectedAgent 类型
export type DetectedAgent<K extends DetectedAgentKind = DetectedAgentKind> = {
  id: string;
  name: string;
  kind: K;
  available: boolean;
  backend: string;  // 用于路由和显示
} & KindFields[K];

// 便捷别名
export type AcpDetectedAgent = DetectedAgent<'acp'>;
export type GeminiDetectedAgent = DetectedAgent<'gemini'>;
export type RemoteDetectedAgent = DetectedAgent<'remote'>;
export type AionrsDetectedAgent = DetectedAgent<'aionrs'>;
export type NanobotDetectedAgent = DetectedAgent<'nanobot'>;
export type OpenClawDetectedAgent = DetectedAgent<'openclaw-gateway'>;
```

### 2.2 类型设计亮点

**泛型 `DetectedAgent<K>`**:
- 通用列表使用 `DetectedAgent`（全 union）
- 特定 kind 使用 `DetectedAgent<'acp'>`（直接访问 kind 字段）
- TypeScript 编译时保证类型安全

---

## 三、AgentRegistry 核心实现

### 3.1 单例模式

```typescript
class AgentRegistry {
  private detectedAgents: DetectedAgent[] = [];
  private isInitialized = false;
  private mutationQueue: Promise<void> = Promise.resolve();

  // 子检测器结果缓存
  private builtinAgents: AcpDetectedAgent[] = [];
  private extensionAgents: AcpDetectedAgent[] = [];
  private remoteAgents: RemoteDetectedAgent[] = [];
  private otherAgents: DetectedAgent[] = [];
  private customAgents: AcpDetectedAgent[] = [];
}
```

### 3.2 Agent 来源

| 来源 | 说明 |
|------|------|
| `gemini` | 始终存在（无需检测） |
| `aionrs` | 始终存在（Rust 二进制，运行时检测可用性） |
| `builtin` | PATH 上的 CLI agents |
| `extension` | Hub 扩展贡献 |
| `remote` | 用户配置的 WebSocket agents |
| `other` | openclaw-gateway, nanobot |
| `custom` | 用户定义的 ACP CLIs |

### 3.3 互斥变异队列

```typescript
private async runExclusiveMutation<T>(task: () => Promise<T>): Promise<T> {
  const previousMutation = this.mutationQueue;
  let releaseCurrentMutation: (() => void) | undefined;

  this.mutationQueue = new Promise<void>((resolve) => {
    releaseCurrentMutation = resolve;
  });

  await previousMutation;

  try {
    return await task();
  } finally {
    releaseCurrentMutation?.();
  }
}
```

### 3.4 并发检测

```typescript
private async detectAll(): Promise<void> {
  acpDetector.clearEnvCache();

  const [builtinAgents, extensionAgents, remoteAgents, customAgents] = await Promise.all([
    acpDetector.detectBuiltinAgents(),
    acpDetector.detectExtensionAgents(),
    this.loadRemoteAgents(),
    acpDetector.detectCustomAgents(),
  ]);

  this.builtinAgents = builtinAgents;
  this.extensionAgents = extensionAgents;
  this.remoteAgents = remoteAgents;
  this.customAgents = customAgents;
  this.otherAgents = this.detectOtherCliAgents();
  this.merge();
}
```

### 3.5 去重逻辑

```typescript
private deduplicate(agents: DetectedAgent[]): DetectedAgent[] {
  const seen = new Set<string>();
  const result: DetectedAgent[] = [];

  for (const agent of agents) {
    // Remote 和 custom 共享 backend 但有唯一 id，保留
    // 其他按 backend 去重
    const key = agent.kind === 'remote' || agent.backend === 'custom' 
      ? agent.id 
      : agent.backend;
    
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(agent);
  }

  return result;
}
```

**优先级**: Aionrs > Gemini > Builtin > Other > Remote > Extension > Custom

### 3.6 公开 API

```typescript
export class AgentRegistry {
  // 初始化（触发全量检测）
  async initialize(): Promise<void> {}

  // 获取所有检测到的 Agent
  getDetectedAgents(): DetectedAgent[] {}

  // 仅获取 ACP 类型
  getAcpAgents(): AcpDetectedAgent[] {}

  // 检查是否有 Agent
  hasAgents(): boolean {}

  // 刷新内置 CLI（PATH 可能已变）
  async refreshBuiltinAgents(): Promise<void> {}

  // 刷新扩展贡献的 Agent
  async refreshExtensionAgents(): Promise<void> {}

  // 刷新远程 Agent
  async refreshRemoteAgents(): Promise<void> {}

  // 刷新自定义 Agent
  async refreshCustomAgents(): Promise<void> {}

  // 全量刷新
  async refreshAll(): Promise<void> {}
}

export const agentRegistry = new AgentRegistry();
```

---

## 四、聊天消息类型

### 4.1 chatLib.ts 消息类型

```typescript
type TMessageType =
  | 'text'           // 文本消息
  | 'tips'           // 提示
  | 'tool_call'      // 工具调用
  | 'tool_group'     // 工具组
  | 'agent_status'   // Agent 状态
  | 'acp_permission' // ACP 权限请求
  | 'acp_tool_call' // ACP 工具调用
  | 'codex_permission' // Codex 权限请求
  | 'codex_tool_call' // Codex 工具调用
  | 'plan'           // 计划
  | 'thinking'       // 思考
  | 'available_commands' // 可用命令
  | 'skill_suggest'   // 技能建议
  | 'cron_trigger';   // Cron 触发
```

### 4.2 Codex 事件类型

```typescript
type CodexEventData =
  | ExecCommandBeginData
  | ExecCommandEndData
  | ExecCommandOutputDeltaData
  | McpToolCallBeginData
  | McpToolCallEndData
  | PatchApplyBeginData
  | PatchApplyEndData
  | TurnDiffData
  | WebSearchBeginData
  | WebSearchEndData;
```

---

## 五、Slash 命令类型

### 5.1 types.ts

```typescript
// 执行方式
export type SlashCommandKind = 'template' | 'builtin';

// 选择行为
export type SlashCommandSelectionBehavior = 'execute' | 'insert';

// 来源
export type SlashCommandSource = 'acp' | 'builtin';

// 命令项
export interface SlashCommandItem {
  name: string;              // 命令名（无斜杠前缀）
  description: string;       // 描述
  kind: SlashCommandKind;    // 类型
  source: SlashCommandSource; // 来源
  hint?: string;             // 快捷键提示
  selectionBehavior?: SlashCommandSelectionBehavior;
}
```

---

## 六、tech-cc-hub 借鉴建议

### 6.1 可直接借鉴

| 功能 | AionUi 实现 | 移植价值 |
|------|-------------|----------|
| **DetectedAgent 泛型** | 统一的 Agent 类型系统 | 高 |
| **AgentRegistry 单例** | 集中管理所有 Agent | 高 |
| **互斥变异队列** | 防止并发检测冲突 | 中 |
| **并发检测模式** | Promise.all 并行检测 | 中 |
| **消息类型定义** | 完整的消息类型体系 | 高 |

### 6.2 需要适配

| 功能 | 差异点 |
|------|--------|
| **检测逻辑** | 适配 Claude Agent SDK |
| **远程 Agent** | WebSocket 协议差异 |
| **ACP 兼容** | 我们不需要 ACP 协议 |

### 6.3 实现优先级

| 优先级 | 功能 | 工作量 |
|--------|------|--------|
| P0 | DetectedAgent 类型系统 | 1 day |
| P0 | AgentRegistry 核心 | 2 days |
| P1 | 消息类型定义 | 2 days |
| P1 | SlashCommandItem | 1 day |
| P2 | 远程 Agent 支持 | 5 days |

---

**文档路径**: `doc/00-research/AionUi-调研报告/03-Agent管理层.md`
