/**
 * Extracts a single property from a metadata map.
 *
 * @template M - The metadata map type, mapping keys to objects
 * @template P - The property name within each metadata value to extract
 * @param meta - The metadata object containing mappings of table info
 * @param prop - The property to extract from each metadata entry (e.g. "schema" or "readModel")
 * @returns A new object mapping each key to the extracted property value
 */
export function extractProp<
  M extends Record<string, Record<string, unknown>>,
  P extends keyof M[keyof M]
>(meta: M, prop: P): { [K in keyof M]: M[K][P] } {
  return Object.keys(meta).reduce(
    (acc, key) => ({
      ...acc,
      [key]: meta[key as keyof M][prop],
    }),
    {} as { [K in keyof M]: M[K][P] }
  );
}
