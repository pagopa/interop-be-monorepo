import { apiGatewayApi, authorizationApi } from "pagopa-interop-api-clients";

export function toApiGatewayClient(
  client: authorizationApi.Client
): apiGatewayApi.Client {
  return {
    id: client.id,
    consumerId: client.consumerId,
  };
}
