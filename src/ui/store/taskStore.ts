import { create } from "zustand";
import type { UiTask, UiTaskExecution, UiTaskExecutionLog, UiTaskFilter, UiTaskStats } from "../types";

type TaskState = {
  tasks: UiTask[];
  executions: Record<string, UiTaskExecution[]>;
  executionLogs: Record<string, UiTaskExecutionLog[]>;
  stats: UiTaskStats | null;
  selectedTaskId: string | null;
  filter: UiTaskFilter;
  syncing: boolean;

  // Actions
  setTasks: (tasks: UiTask[]) => void;
  upsertTask: (task: UiTask) => void;
  setStats: (stats: UiTaskStats) => void;
  setExecutions: (taskId: string, executions: UiTaskExecution[]) => void;
  setExecutionLogs: (taskId: string, logs: UiTaskExecutionLog[]) => void;
  setExecutionData: (taskId: string, executions: UiTaskExecution[], logs: UiTaskExecutionLog[]) => void;
  setSelectedTaskId: (id: string | null) => void;
  setFilter: (filter: UiTaskFilter) => void;
  addExecutionLog: (log: UiTaskExecutionLog) => void;
  setSyncing: (syncing: boolean) => void;
};

export const useTaskStore = create<TaskState>((set) => ({
  tasks: [],
  executions: {},
  executionLogs: {},
  stats: null,
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
  setStats: (stats) => set({ stats }),
  setExecutions: (taskId, executions) =>
    set((state) => ({ executions: { ...state.executions, [taskId]: executions } })),
  setExecutionLogs: (taskId, logs) =>
    set((state) => ({ executionLogs: { ...state.executionLogs, [taskId]: logs } })),
  setExecutionData: (taskId, executions, logs) =>
    set((state) => ({
      executions: { ...state.executions, [taskId]: executions },
      executionLogs: { ...state.executionLogs, [taskId]: logs },
    })),
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
