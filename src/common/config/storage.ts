export type TChatConversation = {
  id: string;
  title?: string;
  workspace?: string;
  path?: string;
  [key: string]: unknown;
};

export const ConfigStorage = {
  async get<T = unknown>(key: string): Promise<T | null> {
    try {
      const raw = localStorage.getItem(`config:${key}`);
      return raw == null ? null : (JSON.parse(raw) as T);
    } catch {
      return null;
    }
  },
  async set<T = unknown>(key: string, value: T): Promise<void> {
    localStorage.setItem(`config:${key}`, JSON.stringify(value));
  },
};
