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
