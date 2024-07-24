export function toSetToArray<V>(a: V[]): V[] {
  return Array.from(new Set(a));
}
