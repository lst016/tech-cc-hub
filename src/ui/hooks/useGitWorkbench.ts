import { useCallback, useEffect, useMemo, useState } from "react";
import type { UiGitChangedFile, UiGitCommitDetail, UiGitDiffResult, UiGitResult, UiGitWorkbenchSnapshot } from "../types";

export type SelectedGitFile = {
  path: string;
  staged: boolean;
};

export function useGitWorkbench(cwd?: string) {
  const [snapshot, setSnapshot] = useState<UiGitWorkbenchSnapshot | null>(null);
  const [selectedFile, setSelectedFile] = useState<SelectedGitFile | null>(null);
  const [selectedCommitHash, setSelectedCommitHash] = useState<string | null>(null);
  const [diffResult, setDiffResult] = useState<UiGitDiffResult | null>(null);
  const [commitDetail, setCommitDetail] = useState<UiGitCommitDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [diffLoading, setDiffLoading] = useState(false);
  const [commitDetailLoading, setCommitDetailLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileKey = selectedFile ? `${selectedFile.staged ? "staged" : "worktree"}:${selectedFile.path}` : "";

  const refresh = useCallback(async () => {
    const workspace = cwd?.trim();
    if (!workspace) {
      setSnapshot(null);
      setError("当前会话没有工作区，Git 工作台需要一个 cwd。");
      return;
    }

    setLoading(true);
    try {
      const result = await window.electron.getGitSnapshot({ cwd: workspace });
      if (result.success) {
        setSnapshot(result.data);
        setError(null);
      } else {
        setSnapshot(null);
        setError(result.error.message);
      }
    } catch (nextError) {
      setSnapshot(null);
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setLoading(false);
    }
  }, [cwd]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!snapshot?.files.length) {
      setSelectedFile(null);
      return;
    }

    const stillExists = selectedFile
      ? snapshot.files.some((file) => file.path === selectedFile.path && file.staged === selectedFile.staged)
      : false;
    if (!stillExists) {
      const firstStaged = snapshot.files.find((file) => file.staged);
      const first = firstStaged ?? snapshot.files[0];
      setSelectedFile({ path: first.path, staged: first.staged });
    }
  }, [selectedFile, snapshot]);

  useEffect(() => {
    if (!snapshot?.history.length) {
      setSelectedCommitHash(null);
      return;
    }

    const stillExists = selectedCommitHash
      ? snapshot.history.some((commit) => commit.hash === selectedCommitHash)
      : false;
    if (!stillExists) {
      setSelectedCommitHash(snapshot.history[0]?.hash ?? null);
    }
  }, [selectedCommitHash, snapshot]);

  useEffect(() => {
    const workspace = cwd?.trim();
    if (!workspace || !selectedFile) {
      setDiffResult(null);
      return;
    }

    let cancelled = false;
    setDiffLoading(true);
    void window.electron.getGitDiff({ cwd: workspace, path: selectedFile.path, staged: selectedFile.staged })
      .then((result) => {
        if (cancelled) return;
        if (result.success) {
          setDiffResult(result.data);
        } else {
          setDiffResult({ path: selectedFile.path, staged: selectedFile.staged, diff: `# ${result.error.message}` });
        }
      })
      .catch((nextError) => {
        if (cancelled) return;
        setDiffResult({
          path: selectedFile.path,
          staged: selectedFile.staged,
          diff: `# ${nextError instanceof Error ? nextError.message : String(nextError)}`,
        });
      })
      .finally(() => {
        if (!cancelled) setDiffLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cwd, fileKey, selectedFile]);

  useEffect(() => {
    const workspace = cwd?.trim();
    if (!workspace || !selectedCommitHash) {
      setCommitDetail(null);
      return;
    }

    let cancelled = false;
    setCommitDetailLoading(true);
    void window.electron.getGitCommitDetail({ cwd: workspace, hash: selectedCommitHash })
      .then((result) => {
        if (cancelled) return;
        if (result.success) {
          setCommitDetail(result.data);
        } else {
          setCommitDetail(null);
          setError(result.error.message);
        }
      })
      .catch((nextError) => {
        if (cancelled) return;
        setCommitDetail(null);
        setError(nextError instanceof Error ? nextError.message : String(nextError));
      })
      .finally(() => {
        if (!cancelled) setCommitDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cwd, selectedCommitHash]);

  const selectedChangedFile = useMemo(() => {
    if (!snapshot || !selectedFile) return null;
    return snapshot.files.find((file) => file.path === selectedFile.path && file.staged === selectedFile.staged) ?? null;
  }, [selectedFile, snapshot]);

  const runMutation = useCallback(async (
    label: string,
    fn: () => Promise<UiGitResult<UiGitWorkbenchSnapshot>>,
  ) => {
    const workspace = cwd?.trim();
    if (!workspace) {
      setError("当前会话没有工作区。");
      return;
    }

    setActionBusy(label);
    try {
      const result = await fn();
      if (result.success) {
        setSnapshot(result.data);
        setError(null);
      } else {
        setError(result.error.message);
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setActionBusy(null);
    }
  }, [cwd]);

  const stageFiles = useCallback((paths: string[]) => {
    if (!cwd) return Promise.resolve();
    return runMutation("stage", () => window.electron.gitStageFiles({ cwd, paths }));
  }, [cwd, runMutation]);

  const unstageFiles = useCallback((paths: string[]) => {
    if (!cwd) return Promise.resolve();
    return runMutation("unstage", () => window.electron.gitUnstageFiles({ cwd, paths }));
  }, [cwd, runMutation]);

  const commit = useCallback((message: string, body?: string) => {
    if (!cwd) return Promise.resolve();
    return runMutation("commit", () => window.electron.gitCommit({ cwd, message, body }));
  }, [cwd, runMutation]);

  const pull = useCallback(() => {
    if (!cwd) return Promise.resolve();
    return runMutation("pull", () => window.electron.gitPull({ cwd }));
  }, [cwd, runMutation]);

  const push = useCallback(() => {
    if (!cwd) return Promise.resolve();
    return runMutation("push", () => window.electron.gitPush({ cwd }));
  }, [cwd, runMutation]);

  const createBranch = useCallback((name: string, checkout: boolean) => {
    if (!cwd) return Promise.resolve();
    return runMutation("branch", () => window.electron.gitCreateBranch({ cwd, name, checkout }));
  }, [cwd, runMutation]);

  const checkoutBranch = useCallback((name: string) => {
    if (!cwd) return Promise.resolve();
    return runMutation("checkout", () => window.electron.gitCheckoutBranch({ cwd, name }));
  }, [cwd, runMutation]);

  const stashSave = useCallback((message?: string) => {
    if (!cwd) return Promise.resolve();
    return runMutation("stash", () => window.electron.gitStashSave({ cwd, message }));
  }, [cwd, runMutation]);

  const stashApply = useCallback((ref: string) => {
    if (!cwd) return Promise.resolve();
    return runMutation("stash", () => window.electron.gitStashApply({ cwd, ref }));
  }, [cwd, runMutation]);

  const stashDrop = useCallback((ref: string) => {
    if (!cwd) return Promise.resolve();
    return runMutation("stash", () => window.electron.gitStashDrop({ cwd, ref }));
  }, [cwd, runMutation]);

  const selectFile = useCallback((file: UiGitChangedFile) => {
    setSelectedFile({ path: file.path, staged: file.staged });
  }, []);

  const selectCommit = useCallback((hash: string) => {
    setSelectedCommitHash(hash);
  }, []);

  return {
    snapshot,
    selectedFile,
    selectedCommitHash,
    selectedChangedFile,
    diffResult,
    commitDetail,
    loading,
    diffLoading,
    commitDetailLoading,
    actionBusy,
    error,
    refresh,
    selectFile,
    selectCommit,
    stageFiles,
    unstageFiles,
    commit,
    pull,
    push,
    createBranch,
    checkoutBranch,
    stashSave,
    stashApply,
    stashDrop,
  };
}
