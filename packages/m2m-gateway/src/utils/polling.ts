/* eslint-disable functional/no-let */
import { isAxiosError } from "axios";
import { WithMetadata } from "pagopa-interop-models";
import { config } from "../config/config.js";
import { WithMaybeMetadata } from "../clients/zodiosWithMetadataPatch.js";
import { resourcePollingTimeout } from "../model/errors.js";
import {
  assertMetadataExists,
  assertMetadataVersionExists,
} from "./validators/validators.js";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generic polling function that polls a resource until a condition is met or a timeout occurs.
 *
 * @param fetchResource - Function that returns a Promise to fetch the resource
 * @returns A function that takes a check function and returns a Promise of the polled resource
 */
export function pollResource<T>(
  fetchResource: () => Promise<WithMaybeMetadata<NonNullable<T>>>
) {
  return async function poll({
    checkFn,
    maxAttempts = config.defaultPollingMaxAttempts,
    intervalMs = config.defaultPollingIntervalMs,
  }: {
    checkFn: (polledResource: WithMetadata<NonNullable<T>>) => boolean;
    maxAttempts?: number;
    intervalMs?: number;
  }): Promise<WithMetadata<NonNullable<T>>> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const polledResource = await fetchResource();
        assertMetadataExists(polledResource);
        if (checkFn(polledResource)) {
          return polledResource;
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
): (polledResource: WithMetadata<NonNullable<T>>) => boolean {
  assertMetadataExists(response);
  return (polledResource: WithMetadata<NonNullable<T>>) =>
    polledResource.metadata.version >= response.metadata.version;
}

/**
 * Generic check function that verifies if a polled resource's version meets or exceeds a target version.
 * This can be used with any resource type that includes metadata with a version number.
 *
 * @param targetVersion - The version number that the polled resource should meet or exceed
 * @returns A function that takes a polled resource and returns true if its version is >= targetVersion
 */
export function isPolledVersionAtLeastTargetVersion(
  targetVersion: number | undefined
): <T>(polledResource: WithMetadata<NonNullable<T>>) => boolean {
  assertMetadataVersionExists(targetVersion);
  return <T>(polledResource: WithMetadata<NonNullable<T>>) =>
    polledResource.metadata.version >= targetVersion;
}
