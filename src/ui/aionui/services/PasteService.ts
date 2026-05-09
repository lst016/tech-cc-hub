type PasteHandler = (event: ClipboardEvent) => Promise<boolean> | boolean;

const handlers = new Map<string, PasteHandler>();
let initialized = false;
let lastFocusedComponent = '';

const dispatchPaste = async (event: ClipboardEvent) => {
  const ordered = [lastFocusedComponent, ...handlers.keys()].filter(Boolean);
  for (const id of ordered) {
    const handler = handlers.get(id);
    if (handler && (await handler(event))) return;
  }
};

export const PasteService = {
  init() {
    if (initialized || typeof window === 'undefined') return;
    initialized = true;
    window.addEventListener('paste', (event) => void dispatchPaste(event));
  },
  registerHandler(id: string, handler: PasteHandler) {
    handlers.set(id, handler);
  },
  unregisterHandler(id: string) {
    handlers.delete(id);
  },
  setLastFocusedComponent(id: string) {
    lastFocusedComponent = id;
  },
  async handlePaste(event: ClipboardEvent, handler?: PasteHandler) {
    if (handler) return handler(event);
    await dispatchPaste(event);
    return true;
  },
};
