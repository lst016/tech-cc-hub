# src/ui/hooks/useGitWorkbench.ts

> 模块：`ui-shell` · 语言：`typescript` · 行数：314

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `useGitWorkbench@8`
- `fileKey@20`
- `refresh@22`
- `workspace@24`
- `result@33`
- `stillExists@58`
- `firstStaged@63`
- `first@64`
- `stillExists@74`
- `workspace@84`
- `cancelled@89`
- `workspace@119`
- `cancelled@124`
- `selectedChangedFile@150`
- `runMutation@155`
- `workspace@160`
- `result@168`
- `message@174`
- `stageFiles@186`
- `unstageFiles@191`
- `commit@196`
- `generateCommitMessage@201`
- `workspace@203`
- `result@211`
- `generateCommitMessageRefined@225`
- `workspace@227`
- `result@231`
- `pull@241`
- `push@246`
- `createBranch@251`
- `checkoutBranch@256`
- `stashSave@261`
- `stashApply@266`
- `stashDrop@271`
- `selectFile@276`
- `selectCommit@280`
- `SelectedGitFile@3`
- `fn@158`

## 依赖输入

- `react`
- `../types`

## 对外暴露

- `SelectedGitFile`
- `useGitWorkbench`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import { useCallback, useEffect, useMemo, useState } from "react";
import type { UiGitChangedFile, UiGitCommitDetail, UiGitCommitMessageSuggestion, UiGitDiffResult, UiGitResult, UiGitWorkbenchSnapshot } from "../types";

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
        if (re
... (truncated)
```
