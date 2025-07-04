import { authorizationApi, m2mGatewayApi } from "pagopa-interop-api-clients";
import { match } from "ts-pattern";
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

export function toM2MGatewayApiFullClient(
  client: authorizationApi.FullClient
): m2mGatewayApi.FullClient {
  assertClientKindIs(client, authorizationApi.ClientKind.Values.CONSUMER);

  return {
    visibility: client.visibility,
    id: client.id,
    name: client.name,
    createdAt: client.createdAt,
    consumerId: client.consumerId,
    description: client.description,
  };
}

export function toM2MGatewayApiClient(
  client: authorizationApi.Client
): m2mGatewayApi.Client {
  assertClientKindIs(client, authorizationApi.ClientKind.Values.CONSUMER);

  return match(client)
    .with(
      {
        visibility: authorizationApi.ClientVisibility.Values.COMPACT,
      },
      (client) =>
        ({
          visibility: client.visibility,
          id: client.id,
          consumerId: client.consumerId,
        } satisfies m2mGatewayApi.CompactClient)
    )
    .with(
      {
        visibility: authorizationApi.ClientVisibility.Values.FULL,
      },
      (client) => toM2MGatewayApiFullClient(client)
    )
    .exhaustive();
}
