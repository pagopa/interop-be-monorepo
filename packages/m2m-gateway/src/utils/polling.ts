/* eslint-disable functional/no-let */
import { isAxiosError } from "axios";
import { WithMetadata } from "pagopa-interop-models";
import { config } from "../config/config.js";
import { WithMaybeMetadata } from "../clients/zodiosWithMetadataPatch.js";
import { resourcePollingTimeout } from "../model/errors.js";
import { assertMetadataExists } from "./validators/validators.js";

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
  fetchResource: () => Promise<WithMaybeMetadata<NonNullable<T>>>
) {
  return async function poll({
    checkFn,
    maxAttempts = config.defaultPollingMaxAttempts,
    intervalMs = config.defaultPollingIntervalMs,
  }: {
    checkFn: (resource: WithMetadata<NonNullable<T>>) => boolean;
    maxAttempts?: number;
    intervalMs?: number;
  }): Promise<WithMetadata<NonNullable<T>>> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const resource = await fetchResource();
        assertMetadataExists(resource);
        if (checkFn(resource)) {
          return resource;
        }
      } catch (error: unknown) {
        // If the error isn't 404, rethrow it immediately
        if (!isAxiosError(error) || error.response?.status !== 404) {
          throw error;
        }
      }

      // If we got 404 or checkFn failed, wait for the specified interval before retrying
      await delay(intervalMs);
    }

    throw resourcePollingTimeout(maxAttempts);
  };
}
