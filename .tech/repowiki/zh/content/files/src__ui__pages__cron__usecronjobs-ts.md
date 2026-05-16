# src/ui/pages/cron/useCronJobs.ts

> 模块：`ui-shell` · 语言：`typescript` · 行数：165

## 文件职责

定时任务相关的React hooks，提供任务列表查询和CRUD操作

## 运行信号

- `electron.invoke: cron:update-job`
- `electron.invoke: cron:remove-job`
- `electron.invoke: cron:list-jobs-by-conversation`
- `electron.invoke: cron:list-jobs`

## 关键符号

- `useCronJobActions@0 - 暂停、恢复、删除、更新任务的actions hook`
- `useCronJobs@0 - 获取指定会话的定时任务列表，支持实时事件订阅`
- `useAllCronJobs@0 - 获取所有定时任务，支持分页和状态管理`

## 依赖输入

- `react`
- `../../../types/cron.js`

## 对外暴露

- `useCronJobs`
- `useAllCronJobs`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
// Source: CV from AionUi useCronJobs.ts (540 lines)
// Adapted for tech-cc-hub: window.electron.invoke instead of ipcBridge, hardcoded Chinese,
// removed i18n, router, emitter, localStorage, and unread tracking

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CronJob } from "../../../types/cron.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ElectronAPI = any;

function getElectron(): ElectronAPI {
  return (window as unknown as { electron: ElectronAPI }).electron;
}

// ── Helpers ──

interface CronJobActionsResult {
  pauseJob: (jobId: string) => Promise<void>;
  resumeJob: (jobId: string) => Promise<void>;
  deleteJob: (jobId: string) => Promise<void>;
  updateJob: (jobId: string, updates: Partial<CronJob>) => Promise<CronJob>;
}

function useCronJobActions(
  onJobUpdated?: (jobId: string, job: CronJob) => void,
  onJobDeleted?: (jobId: string) => void,
): CronJobActionsResult {
  const pauseJob = useCallback(async (jobId: string) => {
    const updated = await getElectron().invoke("cron:update-job", { jobId, updates: { enabled: false } });
    onJobUpdated?.(jobId, updated);
  }, [onJobUpdated]);

  const resumeJob = useCallback(async (jobId: string) => {
    const updated = await getElectron().invoke("cron:update-job", { jobId, updates: { enabled: true } });
    onJobUpdated?.(jobId, updated);
  }, [onJobUpdated]);

  const deleteJob = useCallback(async (jobId: string) => {
    await getElectron().invoke("cron:remove-job", { jobId });
    onJobDeleted?.(jobId);
  }, [onJobDeleted]);

  const updateJob = useCallback(async (jobId: string, updates: Partial<CronJob>) => {
    const updated = await getElectron().invoke("cron:update-job", { jobId, updates });
    onJobUpdated?.(jobId, updated);
    return updated;
  }, [onJobUpdated]);

  return { pauseJob, resumeJob, deleteJob, updateJob };
}

// ── Hooks ──

export function useCronJobs(conversationId?: string) {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchJobs = useCallback(async () => {
    if (!conversationId) { setJobs([]); return; }
    setLoading(true);
    setError(null);
    try {
      const result = await getElectron().invoke("cron:list-jobs-by-conversation", { conversationId });
      setJobs(result || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("获取定时任务失败"));
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => { void fetchJobs(); }, [fetchJobs]);

  // Subscribe to events
  useEffect(() => {
    const unsubCreated = window.electron.onCronJobCreated((job: CronJob) => {
      if (job.metadata.conversationId === conversationId) {
        setJobs((prev) => (prev.some((j) => j.id === job.id) ? prev : [...prev, job]));
      }
    });
    const unsubUpdated = window.electron.onCronJobUpdated((job: CronJob) => {
      if (job.metadata.conversationId === conversationId) {
        setJobs((prev) => prev.map((j) => (j.id === job.id ? job : j)));
      }
    });
    const unsubRemoved = window.electron.onCronJobRemoved((data: { jobId: string }) => {
      setJobs((prev) => prev.filter((j) => j.id !== data.jobId));
    });

    return () => {
      unsubCreated();
      unsubUpdated();
      unsubRemoved();
    };
  }, [conversationId]);

  const actions = useCronJobActions();

  return {
    jobs, loading, error,
    hasJobs: jobs.length > 0,
    activeJobsCount: jobs.filter((j) => j.enabled).length,
    hasError: jobs.some((j) => j.state.lastStatus === "error"),
    refetch: fetchJobs,
    ...actions,
  };
}

export function useAllCronJobs() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const allJobs = await getElectron().invoke("cron:list-jobs");
      setJobs(allJobs || []);
    } catch (err) {
      console.error("[useAllCronJobs] 获取任务失败:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchJobs(); }, [fetchJobs]
... (truncated)
```
