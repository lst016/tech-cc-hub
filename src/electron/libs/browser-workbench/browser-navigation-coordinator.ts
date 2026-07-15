export class BrowserNavigationCoordinator {
  private generation = 0;

  begin(): number {
    this.generation += 1;
    return this.generation;
  }

  isCurrent(generation: number): boolean {
    return generation === this.generation;
  }

  invalidate(): void {
    this.generation += 1;
  }
}

export function runIfCurrentBrowserNavigation(
  coordinator: BrowserNavigationCoordinator,
  generation: number,
  isTargetCurrent: () => boolean,
  navigate: () => void,
): void {
  if (coordinator.isCurrent(generation) && isTargetCurrent()) {
    navigate();
  }
}
