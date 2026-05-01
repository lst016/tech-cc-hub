export type FileMetadata = {
  id?: string;
  name: string;
  path?: string;
  size: number;
  type?: string;
  lastModified?: number;
};

export type UploadSource = 'chat' | 'workspace' | 'drag' | 'paste';

const textExtensions = new Set(['txt', 'md', 'markdown', 'json', 'js', 'jsx', 'ts', 'tsx', 'css', 'html', 'xml', 'yml', 'yaml', 'py', 'rs', 'go', 'java', 'sh', 'sql']);

export const isSupportedFile = (name: string, supportedExts: string[] = []) => {
  if (supportedExts.length === 0) return true;
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return supportedExts.map((item) => item.replace(/^\./, '').toLowerCase()).includes(ext);
};

export const isTextFile = (path: string) => {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return textExtensions.has(ext);
};

export const uploadFileViaHttp = async (file: File, _conversationId?: string, onProgress?: (progress: number) => void) => {
  onProgress?.(100);
  return {
    id: `${Date.now()}-${file.name}`,
    name: file.name,
    size: file.size,
    type: file.type,
  };
};

export const FileService = {
  async processDroppedFiles(files: FileList | File[], _conversationId?: string, _source?: UploadSource): Promise<FileMetadata[]> {
    return Array.from(files).map((file) => ({
      id: `${Date.now()}-${file.name}`,
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
      path: (file as any).path,
    }));
  },
};
