import { WithMetadata } from "pagopa-interop-models";
import { WithMaybeMetadata } from "../../clients/zodiosWithMetadataPatch.js";
import { missingMetadata } from "../../model/errors.js";

export function assertMetadataExists<T>(
  resource: WithMaybeMetadata<T>
): asserts resource is WithMetadata<T> {
  if (!resource.metadata) {
    throw missingMetadata();
  }
}

export function assertTargetMetadataExists(
  metadata: { version: number } | undefined
): asserts metadata is { version: number } {
  if (metadata === undefined) {
    throw missingMetadata();
  }
}
