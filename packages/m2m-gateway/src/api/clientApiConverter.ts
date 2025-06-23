import { authorizationApi, m2mGatewayApi } from "pagopa-interop-api-clients";
import { assertClientKindIs } from "../utils/validators/delegationValidators.js";

export function toGetClientsApiQueryParams(
  params: m2mGatewayApi.GetClientsQueryParams
): authorizationApi.GetClientsQueryParams {
  return {
    kind: authorizationApi.ClientKind.Values.CONSUMER,
    consumerId: params.consumerId,
    name: params.name,
    userIds: params.userIds,
    purposeId: params.purposeId,
    limit: params.limit,
    offset: params.offset,
  };
}
export function toM2MGatewayApiConsumerClient(
  client: authorizationApi.Client
): m2mGatewayApi.Client {
  assertClientKindIs(client, authorizationApi.ClientKind.Values.CONSUMER);
  return {
    id: client.id,
    consumerId: client.consumerId,
    name: client.name,
    createdAt: client.createdAt,
    description: client.description,
    purposes: client.purposes,
    users: client.users,
  };
}
