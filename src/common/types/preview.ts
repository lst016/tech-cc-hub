export type PreviewContentType =
  | 'code'
  | 'markdown'
  | 'html'
  | 'image'
  | 'pdf'
  | 'word'
  | 'excel'
  | 'ppt'
  | 'diff'
  | 'url';

export type PreviewHistoryTarget = {
  id?: string;
  path?: string;
  filePath?: string;
  title?: string;
  contentType?: PreviewContentType;
};

export type PreviewSnapshotInfo = {
  id: string;
  path: string;
  title?: string;
  createdAt?: number;
  content?: string;
};

export type RemoteImageFetchRequest = {
  url: string;
};
