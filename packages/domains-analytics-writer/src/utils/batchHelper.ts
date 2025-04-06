/**
 * Splits an array into batches of a specified size.
 *
 * @template T - The type of elements in the array.
 * @param array - The array to split into batches.
 * @param batchSize - The number of elements per batch.
 * @returns A generator yielding batches (arrays) of elements.
 */
export function* batchMessages<T>(
  array: T[],
  batchSize: number
): Generator<T[]> {
  // eslint-disable-next-line functional/no-let
  for (let i = 0; i < array.length; i += batchSize) {
    yield array.slice(i, i + batchSize);
  }
}
