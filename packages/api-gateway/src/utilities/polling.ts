/**
 * Generic polling function that waits until an object is created and meets certain criteria
 *
 * @param fetchPromiseFactory - Function that returns a Promise to fetch the object
 * @param options - Additional configuration
 * @returns Promise that resolves to the created/ready object
 */
export async function pollUntilReady<T>(
  fetchPromiseFactory: () => Promise<T | null>,
  options: {
    checkFn: (obj: T) => boolean;
    maxAttempts: number;
    intervalMs: number;
  }
): Promise<T> {
  const { checkFn, maxAttempts, intervalMs } = options;

  // eslint-disable-next-line functional/no-let
  for (let attemptCount = 0; attemptCount < maxAttempts; attemptCount++) {
    try {
      const result = await fetchPromiseFactory();

      if (result && checkFn(result)) {
        return result;
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "status" in error &&
        error.status === 404
      ) {
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
        continue;
      }

      throw error;
    }
  }

  // This also could be mapped to a specific timeout error
  throw new Error(`Polling timed out after ${maxAttempts} attempts`);
}
