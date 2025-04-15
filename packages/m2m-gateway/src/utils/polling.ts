/* eslint-disable functional/no-let */
import { isAxiosError } from "axios";
import { config } from "../config/config.js";
import { WithMaybeMetadata } from "./zodiosMetadataPlugin.js";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generic polling function that waits until an object is created and meets certain criteria
 *
 * @param fetchResourceFunction - Function that returns a Promise to fetch the object
 * @param options - Additional configuration
 * @returns Promise that resolves to the created/ready object
 */
export function pollResource<T>(
  fetchResource: () => Promise<WithMaybeMetadata<T>>
) {
  return async function poll({
    checkFn,
    maxAttempts = config.defaultPollingMaxAttempts,
    intervalMs = config.defaultPollingIntervalMs,
  }: {
    checkFn: (resource: WithMaybeMetadata<T>) => boolean;
    maxAttempts?: number;
    intervalMs?: number;
  }): Promise<WithMaybeMetadata<T>> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      let resource: WithMaybeMetadata<T> | null = null;

      try {
        resource = await fetchResource();
      } catch (error: unknown) {
        // If the error isn't 404, rethrow it immediately
        if (!isAxiosError(error) || error.response?.status !== 404) {
          throw error;
        }
        // If it's 404, we'll just let resource be null and continue
      }

      // If resource is valid and meets our check, return it
      if (resource && checkFn(resource)) {
        return resource;
      }

      // If it's not valid or we got 404, wait before trying again
      await delay(intervalMs);
    }

    // If we exhaust all attempts, throw a timeout error.
    throw new Error(`Polling timed out after ${maxAttempts} attempts`);
  };
}
