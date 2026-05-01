export type FileChangeInfo = {
  filePath: string;
  status?: string;
  diff?: string;
  staged?: boolean;
  isText?: boolean;
};

export type SnapshotInfo = {
  id: string;
  createdAt?: number;
  label?: string;
};

export type CompareResult = {
  changes: FileChangeInfo[];
  snapshots?: SnapshotInfo[];
};
