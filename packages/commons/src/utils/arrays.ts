export function isDefined<V>(value: V | null | undefined): value is V {
  return value !== null && value !== undefined;
}

export function toSetToArray<V>(a: V[]): V[] {
  return Array.from(new Set(a));
}
