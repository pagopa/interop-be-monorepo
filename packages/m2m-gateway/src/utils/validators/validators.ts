import { WithMetadata } from "pagopa-interop-models";
import { WithMaybeMetadata } from "../../clients/zodiosWithMetadataPatch.js";
import {
  invalidPaginationLimit,
  invalidPaginationOffset,
  missingMetadata,
} from "../../model/errors.js";

export function assertMetadataExists<T>(
  resource: WithMaybeMetadata<T>
): asserts resource is WithMetadata<T> {
  if (!resource.metadata) {
    throw missingMetadata();
  }
}

export function assertValidPaginationOffset(
  offset: number
): asserts offset is number {
  if (offset < 0) {
    throw invalidPaginationOffset(offset);
  }
}

export function assertValidPaginationLimit(
  limit: number
): asserts limit is number {
  if (limit < 1) {
    throw invalidPaginationLimit(limit);
  }
}
