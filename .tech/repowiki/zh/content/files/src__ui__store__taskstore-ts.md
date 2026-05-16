# src/ui/store/taskStore.ts

> 模块：`ui-shell` · 语言：`typescript` · 行数：110

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `useTaskStore@42`
- `idx@59`
- `next@61`
- `existing@100`
- `TaskState@13`
- `setTasks@28`
- `upsertTask@29`
- `removeTask@30`
- `setStats@31`
- `setExecutions@32`
- `setExecutionLogs@33`
- `setExecutionData@34`
- `setTaskSettings@35`
- `setProviders@36`
- `setSelectedTaskId@37`
- `setFilter@38`
- `addExecutionLog@39`
- `setSyncing@40`
- `setTasks@55`
- `upsertTask@57`
- `removeTask@67`
- `setStats@82`
- `setExecutions@83`
- `setExecutionLogs@85`
- `setExecutionData@87`
- `setTaskSettings@94`
- `setProviders@95`
- `setSelectedTaskId@96`
- `setFilter@97`
- `addExecutionLog@98`
- `setSyncing@108`

## 依赖输入

- `zustand`
- `../types`

## 对外暴露

- `useTaskStore`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import { create } from "zustand";
import type {
  UiTask,
  UiTaskArtifact,
  UiTaskExecution,
  UiTaskExecutionLog,
  UiTaskFilter,
  UiTaskProviderState,
  UiTaskStats,
  UiTaskSubtask,
  UiTaskWorkflowSettings,
} from "../types";

type TaskState = {
  tasks: UiTask[];
  executions: Record<string, UiTaskExecution[]>;
  executionLogs: Record<string, UiTaskExecutionLog[]>;
  subtasks: Record<string, UiTaskSubtask[]>;
  artifacts: Record<string, UiTaskArtifact[]>;
  stats: UiTaskStats | null;
  settings: UiTaskWorkflowSettings | null;
  providers: UiTaskProviderState[];
  selectedTaskId: string | null;
  filter: UiTaskFilter;
  syncing: boolean;

  // Actions
  setTasks: (tasks: UiTask[]) => void;
  upsertTask: (task: UiTask) => void;
  removeTask: (taskId: string) => void;
  setStats: (stats: UiTaskStats) => void;
  setExecutions: (taskId: string, executions: UiTaskExecution[]) => void;
  setExecutionLogs: (taskId: string, logs: UiTaskExecutionLog[]) => void;
  setExecutionData: (taskId: string, executions: UiTaskExecution[], logs: UiTaskExecutionLog[], subtasks?: UiTaskSubtask[], artifacts?: UiTaskArtifact[]) => void;
  setTaskSettings: (settings: UiTaskWorkflowSettings) => void;
  setProviders: (providers: UiTaskProviderState[]) => void;
  setSelectedTaskId: (id: string | null) => void;
  setFilter: (filter: UiTaskFilter) => void;
  addExecutionLog: (log: UiTaskExecutionLog) => void;
  setSyncing: (syncing: boolean) => void;
};

export const useTaskStore = create<TaskState>((set) => ({
  tasks: [],
  executions: {},
  executionLogs: {},
  subtasks: {},
  artifacts: {},
  stats: null,
  settings: null,
  providers: [],
  selectedTaskId: null,
  filter: {},
  syncing: false,

  setTasks: (tasks) => set({ tasks }),
  upsertTask: (task) =>
    set((state) => {
      const idx = state.tasks.findIndex((t) => t.id === task.id);
      if (idx >= 0) {
        const next = [...state.tasks];
        next[idx] = task;
        return { tasks: next };
      }
      return { tasks: [task, ...state.tasks] };
    }),
  removeTask: (taskId) =>
    set((state) => {
      const { [taskId]: _executions, ...executions } = state.executions;
      const { [taskId]: _logs, ...executionLogs } = state.executionLogs;
      const { [taskId]: _subtasks, ...subtasks } = state.subtasks;
      const { [taskId]: _artifacts, ...artifacts } = state.artifacts;
      return {
        tasks: state.tasks.filter((task) => task.id !== taskId),
        selectedTaskId: state.selectedTaskId === taskId ? null : state.selectedTaskId,
        executions,
        executionLogs,
        subtasks,
        artifacts,
      };
    }),
  setStats: (stats) => set({ stats }),
  setExecutions: (taskId, executions) =>
    set((state) => ({ executions: { ...state.executions, [taskId]: executions } })),
  setExecutionLogs: (taskId, logs) =>
    set((state) => ({ executionLogs: { ...state.executionLogs, [taskId]: logs } })),
  setExecutionData: (taskId, executions, logs, subtasks, artifacts) =>
    set((state) => ({
      executions: { ...state.executions, [taskId]: executions },
      executionLogs: { ...state.executionLogs, [taskId]: logs },
      subtasks: subtasks ? { ...state.subtasks, [taskId]: subtasks } : state.subtasks,
      artifacts: artifacts ? { ...state.artifacts, [taskId]: artifacts } : state.artifacts,
    })),
  setTaskSettings: (settings) => set({ settings }),
  setProviders: (providers) => set({ providers }),
  setSelectedTaskId: (id) => set({ selectedTaskId: id }),
  setFilter: (filter) => set({ filter }),
  addExecutionLog: (log) =>
    set((state) => {
      const existing = state.executionLogs[log.taskId] ?? [];
      return {
        executionLogs: {
          ...state.executionLogs,
          [log.taskId]: [...existing, log],
        },
      };
    }),
  setSyncing: (syncing) => set({ syncing }),
}));

```
