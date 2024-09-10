/**
 * Zip two arrays based on a matching key
 * Non-matching values are discarded.
 * Note: the key value must be unique in array b
 *
 * @param a
 * @param b
 * @param getValueA Function that extracts the key for array a
 * @param getValueB Function that extracts the key for array b
 * @returns
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
