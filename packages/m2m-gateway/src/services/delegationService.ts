import { delegationApi, m2mGatewayApi } from "pagopa-interop-api-clients";
import { WithLogger } from "pagopa-interop-commons";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import {
  isPolledVersionAtLeastResponseVersion,
  pollResource,
} from "../utils/polling.js";
import { M2MGatewayAppContext } from "../utils/context.js";
import { toM2MGatewayApiConsumerDelegation } from "../api/delegationApiConverter.js";
import { WithMaybeMetadata } from "../clients/zodiosWithMetadataPatch.js";

export type DelegationService = ReturnType<typeof delegationServiceBuilder>;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function delegationServiceBuilder(clients: PagoPAInteropBeClients) {
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const pollDelegation = (
    response: WithMaybeMetadata<delegationApi.Delegation>,
    headers: M2MGatewayAppContext["headers"]
  ) =>
    pollResource(() =>
      clients.delegationProcessClient.delegation.getDelegation({
        params: { delegationId: response.data.id },
        headers,
      })
    )({
      checkFn: isPolledVersionAtLeastResponseVersion(response),
    });

  return {
    async createConsumerDelegation(
      seed: m2mGatewayApi.DelegationSeed,
      { headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.ConsumerDelegation> {
      const response =
        await clients.delegationProcessClient.consumer.createConsumerDelegation(
          seed,
          {
            headers,
          }
        );

      const polledResource = await pollDelegation(response, headers);

      return toM2MGatewayApiConsumerDelegation(polledResource.data);
    },
    async rejectConsumerDelegation(
      delegationId: string,
      { rejectionReason }: m2mGatewayApi.DelegationRejection,
      { headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.ConsumerDelegation> {
      const response =
        await clients.delegationProcessClient.consumer.rejectConsumerDelegation(
          { rejectionReason },
          {
            params: {
              delegationId,
            },
            headers,
          }
        );

      const polledResource = await pollDelegation(response, headers);

      return toM2MGatewayApiConsumerDelegation(polledResource.data);
    },
  };
}
