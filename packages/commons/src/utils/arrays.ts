export function toSetToArray<V>(a: V[]): V[] {
  return Array.from(new Set(a));
}

export function filterUndefined<T>(item: T | undefined): item is T {
  return !!item;
}
