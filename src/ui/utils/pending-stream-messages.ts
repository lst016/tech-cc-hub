export function appendPendingStreamMessages<T>(
  queue: T[] | undefined,
  nextItems: readonly T[],
): T[] {
  const target = queue ?? [];
  for (const item of nextItems) {
    target.push(item);
  }
  return target;
}
