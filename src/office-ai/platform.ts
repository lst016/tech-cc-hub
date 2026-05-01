type Handler = (...args: any[]) => void;
const listeners = new Map<string, Set<Handler>>();

const on = (event: string, handler: Handler) => {
  const set = listeners.get(event) ?? new Set<Handler>();
  set.add(handler);
  listeners.set(event, set);
};

const off = (event: string, handler: Handler) => {
  listeners.get(event)?.delete(handler);
};

const emit = (event: string, ...args: any[]) => {
  listeners.get(event)?.forEach((handler) => handler(...args));
};

export const bridge = {
  on,
  off,
  emit,
  status: {
    on: (_handler: Handler) => () => undefined,
  },
  start: {
    invoke: async () => ({ success: false, error: 'Office watch is not wired in tech-cc-hub yet.' }),
  },
  stop: {
    invoke: async () => ({ success: true }),
  },
};
