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

/**
 * Zip two arrays based on a matching key
 * Non-matching values are discarded.
 * Note: the key value must be unique in array b
 *
 * @param a
 * @param b
 * @param getValueA Function that extracts the key for array a
 * @param getValueB Function that extracts the key for array b
 * @returns array of tuples, where each tuple is of the form [A, B],
 * containing one element from a and one from b whose keys match based on the accessor functions.
 */
export function zipBy<A, B, K>(
  a: A[],
  b: B[],
  getValueA: (a: A) => K,
  getValueB: (b: B) => K
): Array<[A, B]> {
  const mapB = new Map<K, B>();

  b.forEach((bv) => mapB.set(getValueB(bv), bv));

  return a
    .map((av) => [av, mapB.get(getValueA(av))])
    .filter(([_, bv]) => bv !== undefined) as Array<[A, B]>;
}
