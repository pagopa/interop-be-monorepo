/* eslint-disable functional/no-let */
import { createPollingByCondition, delay } from "pagopa-interop-commons";
import { isAxiosError } from "axios";
import { pollingMaxRetriesExceeded } from "pagopa-interop-models";
import { config } from "../config/config.js";
import { WithMaybeMetadata } from "../clients/zodiosWithMetadataPatch.js";
import {
  assertMetadataExists,
  assertTargetMetadataExists,
} from "./validators/validators.js";

/**
 * Generic polling function that polls a fetch call of a resource with metadata
 * until a condition is met or max retries are exceeded.
 *
 * @param fetch - Function that returns a Promise that fetches the resource with metadata
 * @returns A function that takes a condition function and returns a Promise of the polled resource
 */
export function pollResourceWithMetadata<T>(
  fetch: () => Promise<WithMaybeMetadata<NonNullable<T>>>
): ReturnType<
  typeof createPollingByCondition<WithMaybeMetadata<NonNullable<T>>>
> {
  return createPollingByCondition(fetch, {
    defaultPollingMaxRetries: config.defaultPollingMaxRetries,
    defaultPollingRetryDelay: config.defaultPollingRetryDelay,
  });
}

/**
 * Polls a resource by repeatedly calling the provided fetch function until the resource is deleted
 * (i.e., a 404 Not Found is returned) or the maximum number of retries is exceeded.
 *
 * @param fetch - A function that returns a Promise resolving when the resource exists,
 *                and rejects with a 404 error when the resource is deleted.
 * @returns  Resolves when the resource is confirmed deleted.
 */
export async function pollResourceUntilDeletion(
  fetch: () => Promise<unknown>
): Promise<void> {
  const maxRetries = config.defaultPollingMaxRetries;
  const retryDelay = config.defaultPollingRetryDelay;

  // eslint-disable-next-line functional/no-let
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await fetch();
    } catch (error: unknown) {
      if (isAxiosError(error) && error.response?.status === 404) {
        return;
      }
      throw error;
    }
    await delay(retryDelay);
  }

  throw pollingMaxRetriesExceeded(maxRetries, retryDelay);
}

/**
 Default polling check function that checks if the polled resource's version is greater than
 the version of the resource of a given response.
 Example usage:
 - Create or update a resource, obtaining "response" as the result of the operation
 - Poll the created/updated resource using the "pollResource" function
 - Pass the "response" to this function to obtain the "checkFn" to be passed to "pollResource"
 */
export function isPolledVersionAtLeastResponseVersion<T>(
  response: WithMaybeMetadata<NonNullable<T>>
): (polledResource: WithMaybeMetadata<NonNullable<T>>) => boolean {
  assertMetadataExists(response);
  return (polledResource: WithMaybeMetadata<NonNullable<T>>) => {
    assertMetadataExists(polledResource);
    return polledResource.metadata.version >= response.metadata.version;
  };
}

/**
 * Generic check function that verifies if a polled resource's version meets or exceeds a target version.
 * Use this when only metadata (with a version number) is available rather than a full resource response.
 * For cases where a complete response object is available, use isPolledVersionAtLeastResponseVersion instead.
 *
 * @param metadata - Object containing the target version number to compare against
 * @returns A function that takes a polled resource and returns true if its version is >= target version
 */
export function isPolledVersionAtLeastMetadataTargetVersion(
  metadata: { version: number } | undefined
): <T>(polledResource: WithMaybeMetadata<NonNullable<T>>) => boolean {
  assertTargetMetadataExists(metadata);
  return <T>(polledResource: WithMaybeMetadata<NonNullable<T>>) => {
    assertMetadataExists(polledResource);
    return polledResource.metadata.version >= metadata.version;
  };
}
