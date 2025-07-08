import { WithMetadata, unauthorizedError } from "pagopa-interop-models";
import { authorizationApi } from "pagopa-interop-api-clients";
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

export function assertClientVisibilityIsFull(
  client: authorizationApi.Client
): asserts client is authorizationApi.Client & {
  visibility: typeof authorizationApi.ClientVisibility.Values.FULL;
} {
  if (client.visibility !== authorizationApi.ClientVisibility.Values.FULL) {
    throw unauthorizedError(
      `Tenant is not the owner of the client with id ${client.id}`
    );
  }
}
