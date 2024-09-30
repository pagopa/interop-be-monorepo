export function isDefined<V>(value: V | null | undefined): value is V {
  return value !== null && value !== undefined;
}

export function removeDuplicates<V extends string | number>(a: V[]): V[] {
  return Array.from(new Set(a));
}

export function removeDuplicateObjectsById<A extends { id: string }>(
  objects: A[]
): A[] {
  const uniqueIds = removeDuplicates(objects.map((a) => a.id));

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return uniqueIds.map((id) => objects.find((a) => a.id === id)!);
}
