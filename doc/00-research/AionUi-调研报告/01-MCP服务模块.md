# AionUi 调研报告 - MCP 服务模块

**模块**: `src/process/services/mcpServices/`
**调研时间**: 2026-05-01

---

## 一、MCP 协议接口定义

### 1.1 McpProtocol.ts 核心类型

```typescript
// MCP 源类型
export type McpSource = AcpBackendAll | 'gemini' | 'aionui' | 'aionrs';

// MCP 操作结果
export interface McpOperationResult {
  success: boolean;
  error?: string;
}

// MCP 连接测试结果
export interface McpConnectionTestResult {
  success: boolean;
  tools?: Array<{ name: string; description?: string; _meta?: Record<string, unknown> }>;
  error?: string;
  needsAuth?: boolean;
  authMethod?: 'oauth' | 'basic';
  wwwAuthenticate?: string;
}

// MCP 检测结果
export interface DetectedMcpServer {
  source: McpSource;
  servers: IMcpServer[];
}

// MCP 同步结果
export interface McpSyncResult {
  success: boolean;
  results: Array<{
    agent: string;
    success: boolean;
    error?: string;
  }>;
}
```

### 1.2 IMcpProtocol 接口

```typescript
export interface IMcpProtocol {
  // 检测 MCP 配置
  detectMcpServers(cliPath?: string): Promise<IMcpServer[]>;
  
  // 安装 MCP 服务器到 agent
  installMcpServers(mcpServers: IMcpServer[]): Promise<McpOperationResult>;
  
  // 从 agent 删除 MCP 服务器
  removeMcpServer(mcpServerName: string): Promise<McpOperationResult>;
  
  // 测试 MCP 服务器连接
  testMcpConnection(server: IMcpServer): Promise<McpConnectionTestResult>;
  
  // 获取支持的传输类型
  getSupportedTransports(): string[];
  
  // 获取 agent 后端类型
  getBackendType(): McpSource;
}
```

---

## 二、MCP 服务架构

### 2.1 McpService 主类

```
McpService
├── agents: Map<McpSource, IMcpProtocol>
├── operationQueue: Promise<unknown>  // 服务级操作锁
│
├── withServiceLock<T>()              // 确保操作串行化
├── isCliAvailable()                  // CLI 可用性检测
├── getAgent()                        // 获取 Agent 实例
├── getAgentForConfig()               // 根据配置获取正确 Agent
├── getDetectionTarget()              // 获取检测目标
├── mergeDetectedServers()           // 合并检测结果
└── getAgentMcpConfigs()             // 获取所有 Agent 的 MCP 配置
```

### 2.2 服务级操作锁

**问题**: 并发 `getAgentMcpConfigs` / `syncMcpToAgents` / `removeMcpFromAgents` 会同时启动大量子进程，导致资源耗尽和系统冻结。

**解决方案**:
```typescript
private operationQueue: Promise<unknown> = Promise.resolve();

private withServiceLock<T>(operation: () => Promise<T>): Promise<T> {
  const queued = this.operationQueue.then(operation, () => operation());
  // 即使操作失败，也要保持队列继续
  this.operationQueue = queued.catch(() => {});
  return queued;
}
```

### 2.3 Agent 实例映射

```typescript
this.agents = new Map([
  ['claude', new ClaudeMcpAgent()],
  ['codebuddy', new CodebuddyMcpAgent()],
  ['qwen', new QwenMcpAgent()],
  ['gemini', new GeminiMcpAgent()],
  ['aionui', new AionuiMcpAgent()],
  ['codex', new CodexMcpAgent()],
  ['opencode', new OpencodeMcpAgent()],
  ['aionrs', new AionrsMcpAgent()],
]);
```

---

## 三、MCP Agent 实现

### 3.1 抽象基类 AbstractMcpAgent

```typescript
export abstract class AbstractMcpAgent implements IMcpProtocol {
  protected readonly backend: McpSource;
  protected readonly timeout: number;
  private operationQueue: Promise<any> = Promise.resolve();

  // 确保操作串行执行的互斥锁
  protected withLock<T>(operation: () => Promise<T>): Promise<T> {
    // ...
  }
}
```

### 3.2 实现的 Agent 类型

| Agent | 说明 |
|-------|------|
| `ClaudeMcpAgent` | Claude CLI MCP 管理 |
| `CodebuddyMcpAgent` | Codebuddy MCP 管理 |
| `QwenMcpAgent` | 通义千问 MCP 管理 |
| `GeminiMcpAgent` | 原生 Gemini CLI MCP 管理 |
| `AionuiMcpAgent` | AionUi 本地 @office-ai/aioncli-core |
| `CodexMcpAgent` | Codex MCP 管理 |
| `OpencodeMcpAgent` | OpenCode MCP 管理 |
| `AionrsMcpAgent` | Aion CLI (Rust binary, TOML config) |

### 3.3 传输类型支持

```typescript
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
```

---

## 四、关键设计模式

### 4.1 Agent 配置与检测

**Fork Gemini vs Native Gemini 区分**:

```typescript
private getAgentForConfig(agent: { backend: string; cliPath?: string }): IMcpProtocol | undefined {
  // Fork Gemini (cliPath=undefined) 使用 AionuiMcpAgent
  if (agent.backend === 'gemini' && !agent.cliPath) {
    return this.agents.get('aionui');
  }
  return this.agents.get(agent.backend as McpSource);
}
```

### 4.2 检测结果合并

**问题**: 同一 MCP 服务器名称可能在多个 Agent 中出现，导致重复行。

```typescript
private mergeDetectedServers(results: DetectedMcpServer[]): DetectedMcpServer[] {
  const merged = new Map<McpSource, Map<string, IMcpServer>>();
  
  results.forEach((result) => {
    const serversByName = merged.get(result.source) ?? new Map<string, IMcpServer>();
    result.servers.forEach((server) => {
      if (!serversByName.has(server.name)) {
        serversByName.set(server.name, server);
      }
    });
    merged.set(result.source, serversByName);
  });
  
  return Array.from(merged.entries()).map(...);
}
```

### 4.3 CLI 可用性检测

```typescript
private isCliAvailable(cliCommand: string): boolean {
  const isWindows = process.platform === 'win32';
  const whichCommand = isWindows ? 'where' : 'which';
  
  try {
    execSync(`${whichCommand} ${cliCommand}`, { encoding: 'utf-8', stdio: 'pipe', timeout: 1000 });
    return true;
  } catch {
    if (!isWindows) return false;
  }
  
  // Windows PowerShell 回退
  if (isWindows) {
    try {
      execSync(
        `powershell -NoProfile -NonInteractive -Command "Get-Command -All ${cliCommand} | Select-Object -First 1 | Out-Null"`,
        { ... }
      );
      return true;
    } catch {
      return false;
    }
  }
  
  return false;
}
```

---

## 五、MCP OAuth 服务

### 5.1 McpOAuthService.ts

支持 OAuth 认证流程：
- 检测需要认证的 MCP 服务器
- 处理 OAuth 回调
- 管理 token 刷新

---

## 六、tech-cc-hub 借鉴建议

### 6.1 立即可借鉴

1. **IMcpProtocol 接口设计** — 统一的 MCP 操作协议
2. **操作队列模式** — 防止并发资源耗尽
3. **检测结果合并** — UI 层去重

### 6.2 需要适配

4. **AbstractMcpAgent 基类** — 适配我们的 Claude Agent SDK
5. **CLI 检测逻辑** — 跨平台路径检测

### 6.3 实现优先级

| 优先级 | 功能 | 工作量 |
|--------|------|--------|
| P0 | 定义 IMcpProtocol 接口 | 1 day |
| P0 | 实现 ClaudeMcpAgent | 3 days |
| P1 | MCP 设置 UI | 2 days |
| P2 | MCP OAuth 支持 | 5 days |

---

**文档路径**: `doc/00-research/AionUi-调研报告/01-MCP服务模块.md`
