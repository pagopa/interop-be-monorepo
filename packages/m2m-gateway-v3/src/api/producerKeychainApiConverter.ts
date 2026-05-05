import { authorizationApi, m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { match } from "ts-pattern";

export function toGetProducerKeychainsApiQueryParams(
  params: m2mGatewayApiV3.GetProducerKeychainsQueryParams
): authorizationApi.GetProducerKeychainsQueryParams {
  return {
    name: params.name,
    producerId: params.producerId,
    limit: params.limit,
    offset: params.offset,
    userIds: [],
    eserviceId: undefined,
  };
}

function toM2MGatewayApiFullProducerKeychain(
  producerKeychain: authorizationApi.FullProducerKeychain
): m2mGatewayApiV3.FullProducerKeychain {
  return {
    id: producerKeychain.id,
    name: producerKeychain.name,
    createdAt: producerKeychain.createdAt,
    producerId: producerKeychain.producerId,
    description: producerKeychain.description,
  };
}

export function toM2MGatewayApiProducerKeychain(
  producerKeychain: authorizationApi.ProducerKeychain
): m2mGatewayApiV3.ProducerKeychain {
  return match(producerKeychain)
    .with(
      {
        visibility: authorizationApi.Visibility.Values.PARTIAL,
      },
      (producerKeychain) =>
        ({
          id: producerKeychain.id,
          producerId: producerKeychain.producerId,
        }) satisfies m2mGatewayApiV3.PartialProducerKeychain
    )
    .with(
      {
        visibility: authorizationApi.Visibility.Values.FULL,
      },
      (producerKeychain) =>
        toM2MGatewayApiFullProducerKeychain(producerKeychain)
    )
    .exhaustive();
}
