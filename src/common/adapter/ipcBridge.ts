export interface IBridgeResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  newPath?: string;
}

export interface IDirOrFile {
  name: string;
  fullPath: string;
  relativePath: string;
  isDir: boolean;
  isFile: boolean;
  children?: IDirOrFile[];
}

export interface IFileMetadata {
  name: string;
  path: string;
  size: number;
  type: string;
  lastModified: number;
  isDirectory?: boolean;
}

export type IWorkspaceFlatFile = {
  name: string;
  fullPath: string;
  relativePath: string;
};

type Unsubscribe = () => void;
type EventCallback<T = unknown> = (event: T) => void;

const noopEvent = <T = unknown>() => {
  const provider = (_callback: EventCallback<T>): Unsubscribe => () => undefined;
  provider.on = (_callback: EventCallback<T>): Unsubscribe => () => undefined;
  return {
    on: (_callback: EventCallback<T>): Unsubscribe => () => undefined,
    off: (_callback: EventCallback<T>): void => undefined,
    provider,
  };
};

const getElectron = () => (typeof window === 'undefined' ? undefined : (window as any).electron);

const getDevPreview = async <T,>(route: string, payload: Record<string, string>): Promise<T | null> => {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(payload);
  const response = await fetch(`/__tech_preview/${route}?${params.toString()}`);
  if (!response.ok) return null;
  return response.json() as Promise<T>;
};

const normalizePath = (input?: string) => (input || '').replace(/\\/g, '/');

const basename = (input: string) => {
  const normalized = normalizePath(input).replace(/\/+$/g, '');
  return normalized.split('/').pop() || normalized || 'workspace';
};

const dirname = (input: string) => {
  const normalized = normalizePath(input);
  const parts = normalized.split('/');
  parts.pop();
  return parts.join('/') || '/';
};

const relativeTo = (root: string, fullPath: string) => {
  const normalizedRoot = normalizePath(root).replace(/\/+$/g, '');
  const normalizedPath = normalizePath(fullPath);
  if (normalizedPath === normalizedRoot) return basename(normalizedRoot);
  if (normalizedPath.startsWith(`${normalizedRoot}/`)) return normalizedPath.slice(normalizedRoot.length + 1);
  return basename(normalizedPath);
};

const readTextFile = async (path: string): Promise<string> => {
  const result = await (getElectron()?.readPreviewFile?.({ cwd: dirname(path), path }) ??
    getDevPreview<any>('read', { cwd: dirname(path), path }));
  if (!result) return '';
  if (typeof result === 'string') return result;
  if (result.success === false) return '';
  return result.content ?? result.data ?? '';
};

const readImageFile = async (path: string): Promise<string> => {
  const explicit = await (getElectron()?.getPreviewImageBase64?.({ cwd: dirname(path), path }) ??
    getDevPreview<any>('read', { cwd: dirname(path), path }));
  if (typeof explicit === 'string') return explicit;
  if (explicit?.content) return explicit.content;
  if (explicit?.data) return explicit.data;
  return readTextFile(path);
};

const listDirectory = async (path: string, cwd = path) => {
  const result = await (getElectron()?.listPreviewDirectory?.({ cwd, path }) ??
    getDevPreview<any>('list', { cwd, path }));
  if (!result) return [];
  if (Array.isArray(result)) return result;
  return result.entries ?? result.data ?? [];
};

const toDirOrFile = async (entry: any, root: string, depth: number): Promise<IDirOrFile> => {
  const fullPath = entry.fullPath ?? entry.path ?? entry.absolutePath ?? '';
  const isDir = Boolean(entry.isDir ?? entry.isDirectory ?? entry.type === 'directory');
  const node: IDirOrFile = {
    name: entry.name ?? basename(fullPath),
    fullPath,
    relativePath: entry.relativePath ?? relativeTo(root, fullPath),
    isDir,
    isFile: Boolean(entry.isFile ?? !isDir),
  };
  if (isDir && depth > 0) {
    const children = await listDirectory(fullPath, root);
    node.children = await Promise.all(children.map((child: any) => toDirOrFile(child, root, depth - 1)));
  }
  return node;
};

const getWorkspaceTree = async (args: { path?: string; workspace?: string; search?: string }) => {
  const root = args.path || args.workspace || '';
  if (!root) return [];
  const entries = await listDirectory(root, root);
  let nodes = await Promise.all(entries.map((entry: any) => toDirOrFile(entry, root, 2)));
  const search = args.search?.trim().toLowerCase();
  if (search) {
    const filter = (items: IDirOrFile[]): IDirOrFile[] =>
      items
        .map((item) => ({ ...item, children: item.children ? filter(item.children) : undefined }))
        .filter((item) => item.name.toLowerCase().includes(search) || Boolean(item.children?.length));
    nodes = filter(nodes);
  }
  return nodes;
};

const success = <T>(data?: T): IBridgeResponse<T> => ({ success: true, data });
const failure = (error: unknown): IBridgeResponse => ({
  success: false,
  error: error instanceof Error ? error.message : String(error),
});

const localPreviewHistoryKey = 'tech-cc-hub:aion-preview-history';
const readPreviewHistory = () => {
  try {
    return JSON.parse(localStorage.getItem(localPreviewHistoryKey) || '[]');
  } catch {
    return [];
  }
};

export const ipcBridge = {
  application: {
    getPath: { invoke: async () => '' },
  },
  conversation: {
    getWorkspace: { invoke: getWorkspaceTree },
    responseStream: noopEvent(),
    turnCompleted: noopEvent(),
    responseSearchWorkSpace: noopEvent(),
    get: { invoke: async () => null },
    update: { invoke: async () => success() },
    createWithConversation: { invoke: async () => success() },
  },
  codexConversation: { responseStream: noopEvent() },
  geminiConversation: { responseStream: noopEvent() },
  acpConversation: { responseStream: noopEvent() },
  database: {
    getConversationMessages: { invoke: async () => [] },
    getUserConversations: { invoke: async () => [] },
  },
  dialog: {
    showOpen: {
      invoke: async (options?: any) => getElectron()?.openPreviewDirectoryDialog?.(options) ?? [],
    },
  },
  fs: {
    readFile: { invoke: async ({ path }: { path: string }) => readTextFile(path) },
    getImageBase64: { invoke: async ({ path }: { path: string }) => readImageFile(path) },
    getFileMetadata: {
      invoke: async ({ path }: { path: string }): Promise<IFileMetadata | null> =>
        getElectron()?.getPreviewFileMetadata?.({ path }) ?? null,
    },
    writeFile: {
      invoke: async ({ path, data }: { path: string; data: string }) => {
        try {
          return (await getElectron()?.writePreviewFile?.({ cwd: dirname(path), path, data })) ?? false;
        } catch (error) {
          return failure(error);
        }
      },
    },
    removeEntry: {
      invoke: async ({ path }: { path: string }) => getElectron()?.removePreviewEntry?.({ cwd: dirname(path), path }) ?? failure('remove unsupported'),
    },
    renameEntry: {
      invoke: async ({ path, newName }: { path: string; newName: string }) =>
        getElectron()?.renamePreviewEntry?.({ cwd: dirname(path), path, newName }) ?? failure('rename unsupported'),
    },
    copyFilesToWorkspace: {
      invoke: async () => failure('copy into workspace is not wired in tech-cc-hub yet'),
    },
    fetchRemoteImage: {
      invoke: async ({ url }: { url: string }) => url,
    },
  },
  shell: {
    openFile: { invoke: async ({ path }: { path: string }) => getElectron()?.openPreviewFile?.({ path }) ?? failure('open unsupported') },
    showItemInFolder: {
      invoke: async ({ path }: { path: string }) => getElectron()?.showPreviewItemInFolder?.({ path }) ?? failure('show unsupported'),
    },
  },
  fileStream: {
    contentUpdate: noopEvent(),
  },
  preview: {
    open: noopEvent(),
  },
  previewHistory: {
    list: { invoke: async () => readPreviewHistory() },
    getContent: { invoke: async ({ path }: { path: string }) => readTextFile(path) },
    save: {
      invoke: async (snapshot: unknown) => {
        const history = readPreviewHistory();
        localStorage.setItem(localPreviewHistoryKey, JSON.stringify([snapshot, ...history].slice(0, 50)));
        return success();
      },
    },
  },
  fileSnapshot: {
    init: { invoke: async () => success() },
    dispose: { invoke: async () => success() },
    getBranches: { invoke: async () => [] },
    compare: { invoke: async () => ({ changes: [], snapshots: [] }) },
    getBaselineContent: { invoke: async () => '' },
    stageFile: { invoke: async () => success() },
    unstageFile: { invoke: async () => success() },
    stageAll: { invoke: async () => success() },
    unstageAll: { invoke: async () => success() },
    resetFile: { invoke: async () => success() },
    discardFile: { invoke: async () => success() },
  },
  team: {
    updateWorkspace: { invoke: async () => success() },
  },
  excelPreview: {},
  wordPreview: {},
  pptPreview: {},
  workspaceOfficeWatch: {
    scan: { invoke: async () => [] },
  },
};

export default ipcBridge;
