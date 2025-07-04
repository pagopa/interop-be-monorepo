import { authorizationApi } from "pagopa-interop-api-clients";
import { Client } from "pagopa-interop-models";

export function testToCompactClient(
  client: Client
): authorizationApi.CompactClient {
  return {
    id: client.id,
    consumerId: client.consumerId,
    kind: client.kind.toUpperCase() as authorizationApi.ClientKind,
    visibility: authorizationApi.ClientVisibility.Enum.COMPACT,
  };
}

export function testToFullClient(client: Client): authorizationApi.FullClient {
  return {
    id: client.id,
    name: client.name,
    consumerId: client.consumerId,
    users: client.users,
    createdAt: client.createdAt.toJSON(),
    purposes: client.purposes,
    kind: client.kind.toUpperCase() as authorizationApi.ClientKind,
    description: client.description,
    adminId: client.adminId,
    visibility: authorizationApi.ClientVisibility.Enum.FULL,
  };
}
