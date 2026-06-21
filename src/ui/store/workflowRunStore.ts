import { create } from "zustand";
import type { WorkflowRunRecord } from "../../shared/workflows/workflow-runs.js";

export type WorkflowRunStoreState = {
  runsBySessionId: Record<string, WorkflowRunRecord[]>;
  selectedRunIdBySessionId: Record<string, string | undefined>;
};

export type WorkflowRunStoreActions = {
  setRuns: (sessionId: string, runs: WorkflowRunRecord[]) => void;
  upsertRun: (run: WorkflowRunRecord) => void;
  selectRun: (sessionId: string, runId: string | undefined) => void;
  clearSession: (sessionId: string) => void;
};

export type WorkflowRunStore = WorkflowRunStoreState & WorkflowRunStoreActions;

function sortRuns(runs: WorkflowRunRecord[]): WorkflowRunRecord[] {
  return [...runs].sort((a, b) => {
    const timeDelta = (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
    if (timeDelta !== 0) return timeDelta;
    return b.id.localeCompare(a.id);
  });
}

function createInitialState(): WorkflowRunStoreState {
  return {
    runsBySessionId: {},
    selectedRunIdBySessionId: {},
  };
}

export function createWorkflowRunStoreState(initialState: WorkflowRunStoreState = createInitialState()): WorkflowRunStore & {
  getState: () => WorkflowRunStoreState;
} {
  let state: WorkflowRunStoreState = {
    runsBySessionId: { ...initialState.runsBySessionId },
    selectedRunIdBySessionId: { ...initialState.selectedRunIdBySessionId },
  };

  const api: WorkflowRunStore & { getState: () => WorkflowRunStoreState } = {
    ...state,
    getState: () => state,
    setRuns: (sessionId, runs) => {
      state = {
        ...state,
        runsBySessionId: {
          ...state.runsBySessionId,
          [sessionId]: sortRuns(runs),
        },
      };
      Object.assign(api, state);
    },
    upsertRun: (run) => {
      const existing = state.runsBySessionId[run.sessionId] ?? [];
      const next = sortRuns([
        ...existing.filter((item) => item.id !== run.id),
        run,
      ]);
      state = {
        ...state,
        runsBySessionId: {
          ...state.runsBySessionId,
          [run.sessionId]: next,
        },
      };
      Object.assign(api, state);
    },
    selectRun: (sessionId, runId) => {
      state = {
        ...state,
        selectedRunIdBySessionId: {
          ...state.selectedRunIdBySessionId,
          [sessionId]: runId,
        },
      };
      Object.assign(api, state);
    },
    clearSession: (sessionId) => {
      const runsBySessionId = { ...state.runsBySessionId };
      const selectedRunIdBySessionId = { ...state.selectedRunIdBySessionId };
      delete runsBySessionId[sessionId];
      delete selectedRunIdBySessionId[sessionId];
      state = {
        runsBySessionId,
        selectedRunIdBySessionId,
      };
      Object.assign(api, state);
    },
  };

  return api;
}

export const useWorkflowRunStore = create<WorkflowRunStore>((set) => ({
  ...createInitialState(),
  setRuns: (sessionId, runs) => set((state) => ({
    runsBySessionId: {
      ...state.runsBySessionId,
      [sessionId]: sortRuns(runs),
    },
  })),
  upsertRun: (run) => set((state) => {
    const existing = state.runsBySessionId[run.sessionId] ?? [];
    return {
      runsBySessionId: {
        ...state.runsBySessionId,
        [run.sessionId]: sortRuns([
          ...existing.filter((item) => item.id !== run.id),
          run,
        ]),
      },
    };
  }),
  selectRun: (sessionId, runId) => set((state) => ({
    selectedRunIdBySessionId: {
      ...state.selectedRunIdBySessionId,
      [sessionId]: runId,
    },
  })),
  clearSession: (sessionId) => set((state) => {
    const runsBySessionId = { ...state.runsBySessionId };
    const selectedRunIdBySessionId = { ...state.selectedRunIdBySessionId };
    delete runsBySessionId[sessionId];
    delete selectedRunIdBySessionId[sessionId];
    return {
      runsBySessionId,
      selectedRunIdBySessionId,
    };
  }),
}));
