# src/electron/libs/task/provider-registry.ts

> 模块：`task-engine` · 语言：`typescript` · 行数：73

## 文件职责

源码文件。依赖：./types.js

## 关键符号

- `registerTaskProvider@4 - `
- `getTaskProvider@8 - `
- `listTaskProviders@12 - `
- `listTaskProviderStates@16 - `
- `ensureProvider@65 - `
- `NoopProvider@32 - `
- `registry@2 - `
- `validation@19 - `
- `existing@67 - `
- `fallback@69 - `

## 依赖输入

- `./types.js`

## 对外暴露

- `registerTaskProvider`
- `getTaskProvider`
- `listTaskProviders`
- `listTaskProviderStates`
- `ensureProvider`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import type { TaskProvider, TaskProviderId, ExternalTask, ExternalTaskStatus, TaskProviderState } from "./types.js";

const registry = new Map<TaskProviderId, TaskProvider>();

export function registerTaskProvider(provider: TaskProvider): void {
  registry.set(provider.id, provider);
}

export function getTaskProvider(id: TaskProviderId): TaskProvider | undefined {
  return registry.get(id);
}

export function listTaskProviders(): TaskProvider[] {
  return Array.from(registry.values());
}

export async function listTaskProviderStates(): Promise<TaskProviderState[]> {
  return Promise.all(Array.from(registry.values()).map(async (provider) => {
    const validation = await provider.validateConfig();
    return {
      id: provider.id,
      name: provider.name,
      enabled: provider.isEnabled?.() ?? true,
      valid: validation.valid,
      error: validation.error,
      capabilities: provider.getCapabilities?.() ?? ["fetch", "status-writeback"],
    };
  }));
}

// Default no-op provider for providers that aren't configured
class NoopProvider implements TaskProvider {
  readonly id: TaskProviderId;
  readonly name: string;

  constructor(id: TaskProviderId) {
    this.id = id;
    this.name = id;
  }

  async fetchTasks(): Promise<ExternalTask[]> {
    return [];
  }

  async getTask(_externalId: string): Promise<ExternalTask | null> {
    return null;
  }

  async updateTaskStatus(_externalId: string, _status: ExternalTaskStatus): Promise<void> {
    // no-op
  }

  async validateConfig(): Promise<{ valid: boolean; error?: string }> {
    return { valid: false, error: `${this.id} provider not configured` };
  }

  isEnabled(): boolean {
    return false;
  }

  getCapabilities() {
    return [] as TaskProviderState["capabilities"];
  }
}

export function ensureProvider(id: TaskProviderId): TaskProvider {
  const existing = registry.get(id);
  if (existing) return existing;
  const fallback = new NoopProvider(id);
  registry.set(id, fallback);
  return fallback;
}

```
