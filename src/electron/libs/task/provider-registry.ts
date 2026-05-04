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
