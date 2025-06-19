/* eslint-disable functional/no-let */
import { createPollingByCondition, delay } from "pagopa-interop-commons";
import { AnyPgTable, AnyPgColumn } from "drizzle-orm/pg-core";
import { DrizzleReturnType } from "pagopa-interop-readmodel-models";
import { eq } from "drizzle-orm";
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

export const new_hasDbBeenUpdated = async (
  db: DrizzleReturnType,
  table: AnyPgTable & {
    metadataVersion: AnyPgColumn<{ data: number }>;
    id: AnyPgColumn;
  },
  metadataVersion: number,
  id: string
): Promise<boolean> => {
  const [row] = await db
    .select({
      metadataVersion: table.metadataVersion,
    })
    .from(table as AnyPgTable)
    .where(eq(table.id, id));

  const existingMetadataVersion = row?.metadataVersion;

  if (existingMetadataVersion == null) {
    return false;
  }
  return existingMetadataVersion >= metadataVersion;
};

export function new_pollResourceBuilder(
  db: DrizzleReturnType,
  sqlTable: AnyPgTable & {
    metadataVersion: AnyPgColumn<{
      data: number;
    }>;
    id: AnyPgColumn;
  }
): (responseWithMetadata: WithMaybeMetadata<{ id: string }>) => Promise<void> {
  return async (responseWithMetadata: WithMaybeMetadata<{ id: string }>) => {
    assertMetadataExists(responseWithMetadata);

    const metadataVersion = responseWithMetadata.metadata.version;
    const resourceId = responseWithMetadata.data.id;

    // eslint-disable-next-line functional/no-let
    for (
      let attempt = 0;
      attempt < config.defaultPollingMaxRetries;
      attempt++
    ) {
      if (
        await new_hasDbBeenUpdated(db, sqlTable, metadataVersion, resourceId)
      ) {
        return;
      }
      await delay(config.defaultPollingRetryDelay);
    }

    throw pollingMaxRetriesExceeded(
      config.defaultPollingMaxRetries,
      config.defaultPollingRetryDelay
    );
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
