import { delegationApi, m2mGatewayApi } from "pagopa-interop-api-clients";
import { WithLogger } from "pagopa-interop-commons";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import {
  isPolledVersionAtLeastResponseVersion,
  pollResource,
} from "../utils/polling.js";
import { M2MGatewayAppContext } from "../utils/context.js";
import { toM2MGatewayApiConsumerDelegation } from "../api/delegationApiConverter.js";
import { assertDelegationKindIs } from "../utils/validators/delegationValidators.js";
import { WithMaybeMetadata } from "../clients/zodiosWithMetadataPatch.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function delegationServiceBuilder({
  delegationProcessClient,
}: PagoPAInteropBeClients) {
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const pollDelegation = (
    response: WithMaybeMetadata<delegationApi.Delegation>,
    headers: M2MGatewayAppContext["headers"]
  ) =>
    pollResource(() =>
      delegationProcessClient.delegation.getDelegation({
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
        await delegationProcessClient.consumer.createConsumerDelegation(seed, {
          headers,
        });

      const polledResource = await pollDelegation(response, headers);

      assertDelegationKindIs(
        polledResource.data,
        delegationApi.DelegationKind.Values.DELEGATED_CONSUMER
      );
      return toM2MGatewayApiConsumerDelegation(polledResource.data);
    },
  };
}
