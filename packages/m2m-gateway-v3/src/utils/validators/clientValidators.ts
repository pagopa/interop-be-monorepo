import { authorizationApi } from "pagopa-interop-api-clients";
import { unauthorizedError } from "pagopa-interop-models";
import { unexpectedClientKind } from "../../model/errors.js";

export function assertClientKindIs<K extends authorizationApi.ClientKind>(
  client: authorizationApi.Client,
  expectedKind: K
): asserts client is authorizationApi.Client & { kind: K } {
  if (client.kind !== expectedKind) {
    throw unexpectedClientKind(client);
  }
}

export function assertClientVisibilityIsFull(
  client: authorizationApi.Client
): asserts client is authorizationApi.Client & {
  visibility: typeof authorizationApi.Visibility.Values.FULL;
} {
  if (client.visibility !== authorizationApi.Visibility.Values.FULL) {
    throw unauthorizedError(
      `Tenant is not the owner of the client with id ${client.id}`
    );
  }
}
