import { authorizationApi, m2mGatewayApi } from "pagopa-interop-api-clients";

export function toM2MGatewayApiClient(
  client: authorizationApi.Client
): m2mGatewayApi.Client {
  return {
    id: client.id,
    name: client.name,
    consumerId: client.consumerId,
    adminId: client.adminId,
    createdAt: client.createdAt,
    purposes: client.purposes,
    description: client.description,
    users: client.users,
    kind: client.kind,
  };
}
