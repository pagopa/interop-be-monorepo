import { authorizationApi, m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { match } from "ts-pattern";
import { assertClientKindIs } from "../utils/validators/clientValidators.js";

export function toGetClientsApiQueryParams(
  params: m2mGatewayApiV3.GetClientsQueryParams
): authorizationApi.GetClientsQueryParams {
  return {
    kind: authorizationApi.ClientKind.Values.CONSUMER,
    consumerId: params.consumerId,
    name: params.name,
    limit: params.limit,
    offset: params.offset,
    userIds: [],
    purposeId: undefined,
  };
}

function toM2MGatewayApiConsumerFullClient(
  client: authorizationApi.FullClient
): m2mGatewayApiV3.FullClient {
  assertClientKindIs(client, authorizationApi.ClientKind.Values.CONSUMER);

  return {
    id: client.id,
    name: client.name,
    createdAt: client.createdAt,
    consumerId: client.consumerId,
    description: client.description,
  };
}

export function toM2MGatewayApiConsumerClient(
  client: authorizationApi.Client
): m2mGatewayApiV3.Client {
  assertClientKindIs(client, authorizationApi.ClientKind.Values.CONSUMER);

  return match(client)
    .with(
      {
        visibility: authorizationApi.Visibility.Values.PARTIAL,
      },
      (client) =>
        ({
          id: client.id,
          consumerId: client.consumerId,
        } satisfies m2mGatewayApiV3.PartialClient)
    )
    .with(
      {
        visibility: authorizationApi.Visibility.Values.FULL,
      },
      (client) => toM2MGatewayApiConsumerFullClient(client)
    )
    .exhaustive();
}
