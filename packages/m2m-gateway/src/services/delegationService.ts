import { delegationApi, m2mGatewayApi } from "pagopa-interop-api-clients";
import { WithLogger } from "pagopa-interop-commons";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { pollResource } from "../utils/polling.js";
import { M2MGatewayAppContext } from "../utils/context.js";
import { assertMetadataExists } from "../utils/validators/validators.js";
import { toM2MGatewayApiConsumerDelegation } from "../model/delegationApiConverter.js";
import { assertDelegationKindIs } from "../utils/validators/delegationValidators.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function delegationServiceBuilder({
  delegationProcessClient,
}: PagoPAInteropBeClients) {
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const pollDelegation = (
    delegationId: delegationApi.Delegation["id"],
    headers: M2MGatewayAppContext["headers"]
  ) =>
    pollResource(() =>
      delegationProcessClient.delegation.getDelegation({
        params: { delegationId },
        headers,
      })
    );

  return {
    async createConsumerDelegation(
      seed: m2mGatewayApi.DelegationSeed,
      { headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.ConsumerDelegation> {
      const response =
        await delegationProcessClient.consumer.createConsumerDelegation(seed, {
          headers,
        });

      const polledResource = await pollDelegation(
        response.data.id,
        headers
      )({
        // TODO maybe this is general enough and could be moved to the polling function?
        checkFn: (polled) => {
          assertMetadataExists(response);
          return polled.metadata.version >= response.metadata.version;
        },
      });

      assertDelegationKindIs(
        polledResource.data,
        delegationApi.DelegationKind.Values.DELEGATED_CONSUMER
      );
      return toM2MGatewayApiConsumerDelegation(polledResource.data);
    },
  };
}
