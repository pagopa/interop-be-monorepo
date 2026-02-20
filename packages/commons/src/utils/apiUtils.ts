import { isAxiosError } from "axios";
import { pollingMaxRetriesExceeded } from "pagopa-interop-models";
import { delay } from "./delay.js";

const DEFAULT_POLLING_MAX_RETRIES = 5;
const DEFAULT_POLLING_RETRY_DELAY = 1000;

/**
 * Generic polling function that polls on a fetch call until a condition is met or max retries are exceeded.
 *
 * @param fetch - Function that returns a Promise that fetches the resource
 * @param config - Optional configuration object to override default polling settings
 * @returns A function that takes a condition function and returns a Promise of the polled resource
 */
export function createPollingByCondition<T>(
  fetch: () => Promise<T>,
  config?: {
    defaultPollingMaxRetries: number;
    defaultPollingRetryDelay: number;
  }
) {
  return async function poll({
    condition,
    maxRetries = config?.defaultPollingMaxRetries ||
      DEFAULT_POLLING_MAX_RETRIES,
    retryDelay = config?.defaultPollingRetryDelay ||
      DEFAULT_POLLING_RETRY_DELAY,
  }: {
    condition: (pollingResult: T) => boolean;
    maxRetries?: number;
    retryDelay?: number;
  }): Promise<T> {
    // eslint-disable-next-line functional/no-let
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const pollingResult = await fetch();
        if (condition(pollingResult)) {
          return pollingResult;
        }
      } catch (error: unknown) {
        // If the error isn't 404, rethrow it immediately
        if (!isAxiosError(error) || error.response?.status !== 404) {
          throw error;
        }
      }
      // If we got 404 or condition failed, wait for the specified delay before retrying
      await delay(retryDelay);
    }

    throw pollingMaxRetriesExceeded(maxRetries, retryDelay);
  };
}

export async function waitForReadModelMetadataVersion(
  fetchResourceWithMetadata: () => Promise<
    { metadata: { version: number } } | undefined
  >,
  targetVersion: number | undefined,
  resourceLabel: string,
  logger: { warn: (message: string) => void },
  pollingConfig?: {
    defaultPollingMaxRetries: number;
    defaultPollingRetryDelay: number;
  }
): Promise<void> {
  if (targetVersion === undefined) {
    logger.warn(
      `Missing metadata version for ${resourceLabel}. Skipping polling.`
    );
    return;
  }

  const pollResourceByVersion = createPollingByCondition(
    fetchResourceWithMetadata,
    pollingConfig
  );

  await pollResourceByVersion({
    condition: (resourceWithMetadata) =>
      resourceWithMetadata !== undefined &&
      resourceWithMetadata.metadata.version >= targetVersion,
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
export function createPollingUntilDeletion(
  fetch: () => Promise<unknown>,
  config?: {
    defaultPollingMaxRetries: number;
    defaultPollingRetryDelay: number;
  }
) {
  return async function poll({
    maxRetries = config?.defaultPollingMaxRetries ||
      DEFAULT_POLLING_MAX_RETRIES,
    retryDelay = config?.defaultPollingRetryDelay ||
      DEFAULT_POLLING_RETRY_DELAY,
  }: {
    maxRetries?: number;
    retryDelay?: number;
  }): Promise<void> {
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
  };
}
