# src/common/adapter/ipcBridge.ts

> 模块：`common` · 语言：`typescript` · 行数：255

## 文件职责

IPC桥接器，封装Electron主进程与渲染进程之间的通信及文件系统操作

## 关键符号

- `IBridgeResponse@0 - 通用响应结构，包含success、data、error、message、newPath字段`
- `IDirOrFile@0 - 目录/文件树结构，包含name、fullPath、relativePath、isDir、isFile、children属性`
- `IFileMetadata@0 - 文件元数据信息`
- `IWorkspaceFlatFile@0 - 工作区文件扁平结构`
- `noopEvent@0 - 创建空事件提供者，用于无Electron环境下的事件分发`
- `getElectron@0 - 获取Electron API实例，检测window.electron是否可用`
- `getDevPreview@0 - 开发环境预览请求，发送GET请求到/__tech_preview端点`
- `normalizePath@0 - 路径规范化，将反斜杠替换为正斜杠`
- `basename@0 - 获取路径最后一段文件名`
- `dirname@0 - 获取路径的目录部分`
- `relativeTo@0 - 计算相对路径，基于根目录计算完整路径的相对路径`
- `readTextFile@0 - 读取文本文件，优先使用Electron API，降级到dev preview`
- `readImageFile@0 - 读取图片文件并返回base64编码`
- `listDirectory@0 - 列出目录内容，返回IDirOrFile数组`
- `toDirOrFile@0 - 将文件元数据转换为IDirOrFile结构`

## 对外暴露

- `IBridgeResponse`
- `IDirOrFile`
- `IFileMetadata`
- `IWorkspaceFlatFile`
- `ipcBridge`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
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
  const root = args.path || args.wor
... (truncated)
```
