export class RunnerTurnLifecycle {
  private pendingTurns = 1;

  reserveAppendedTurn(): { startsNewCycle: boolean } {
    const startsNewCycle = this.pendingTurns === 0;
    this.pendingTurns += 1;
    return { startsNewCycle };
  }

  cancelAppendedTurn(): { hasPendingTurns: boolean } {
    this.pendingTurns = Math.max(0, this.pendingTurns - 1);
    return { hasPendingTurns: this.pendingTurns > 0 };
  }

  completeCurrentTurn(): { hasPendingTurns: boolean } {
    this.pendingTurns = Math.max(0, this.pendingTurns - 1);
    return { hasPendingTurns: this.pendingTurns > 0 };
  }
}
