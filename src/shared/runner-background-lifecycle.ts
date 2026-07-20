type MessageLike = {
  [key: string]: unknown;
  type?: unknown;
  subtype?: unknown;
  state?: unknown;
  tasks?: unknown;
};

export type BackgroundTaskLevelTransition = {
  observed: boolean;
  activeTaskCount: number;
  completed: boolean;
};

/**
 * Tracks the SDK's background_tasks_changed level signal. Session idle is a
 * turn-over signal and may be emitted while background work is still alive;
 * a replacement level of tasks=[] must be observed before a later idle or final
 * result can finish a background-requested run.
 */
export class RunnerBackgroundTaskLifecycle {
  private taskIds = new Set<string>();
  private messageRevision = 0;
  private levelRevision = 0;
  private turnStartRevision = 0;
  private lastNonEmptyRevision = 0;
  private lastEmptyRevision = 0;
  private lastDrainMessageRevision = 0;
  private lastDrainIdleMessageRevision = 0;
  private backgroundRequested = false;
  private drainObserved = false;

  beginTurn(): void {
    this.turnStartRevision = this.levelRevision;
  }

  observeMessage(message: MessageLike): BackgroundTaskLevelTransition {
    this.messageRevision += 1;
    if (message.type !== "system") {
      return {
        observed: false,
        activeTaskCount: this.taskIds.size,
        completed: false,
      };
    }

    if (message.subtype === "session_state_changed" && message.state === "idle") {
      if (this.drainObserved) this.lastDrainIdleMessageRevision = this.messageRevision;
      const completed = this.backgroundRequested
        && this.drainObserved
        && this.lastDrainIdleMessageRevision > this.lastDrainMessageRevision;
      if (completed) this.backgroundRequested = false;
      return {
        observed: false,
        activeTaskCount: this.taskIds.size,
        completed,
      };
    }

    if (message.subtype !== "background_tasks_changed" || !Array.isArray(message.tasks)) {
      return {
        observed: false,
        activeTaskCount: this.taskIds.size,
        completed: false,
      };
    }

    const nextTaskIds = new Set<string>();
    for (const task of message.tasks) {
      if (typeof task !== "object" || task === null || Array.isArray(task)) continue;
      const taskId = (task as { task_id?: unknown }).task_id;
      if (typeof taskId === "string" && taskId.trim()) nextTaskIds.add(taskId.trim());
    }
    this.taskIds = nextTaskIds;
    this.levelRevision += 1;
    if (this.taskIds.size > 0) {
      this.lastNonEmptyRevision = this.levelRevision;
      this.drainObserved = false;
    } else {
      this.lastEmptyRevision = this.levelRevision;
      const currentTurnDrain = this.lastNonEmptyRevision > this.turnStartRevision
        && this.lastEmptyRevision > this.lastNonEmptyRevision;
      if (this.backgroundRequested || currentTurnDrain) {
        this.drainObserved = true;
        this.lastDrainMessageRevision = this.messageRevision;
      }
    }

    return {
      observed: true,
      activeTaskCount: this.taskIds.size,
      completed: false,
    };
  }

  requestBackground(): { active: boolean; completedBeforeResult: boolean } {
    this.drainObserved = this.lastNonEmptyRevision > this.turnStartRevision
      && this.lastEmptyRevision > this.lastNonEmptyRevision;
    const completedBeforeResult = this.drainObserved
      && this.lastDrainIdleMessageRevision > this.lastDrainMessageRevision;
    this.backgroundRequested = !completedBeforeResult;
    return { active: this.backgroundRequested, completedBeforeResult };
  }

  isActive(): boolean {
    return this.backgroundRequested;
  }
}

export function normalizeBackgroundRunnerStatus<T extends string>(
  status: T,
  backgroundActive: boolean | undefined,
): T | "running" {
  return backgroundActive && status === "completed" ? "running" : status;
}

export function getUnexpectedRunnerEndMessage(backgroundActive: boolean): string {
  return backgroundActive
    ? "Background runner ended before the background task membership became empty."
    : "Runner ended without a result message.";
}
