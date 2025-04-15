import { delegationApi, m2mGatewayApi } from "pagopa-interop-api-clients";
import { WithLogger } from "pagopa-interop-commons";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { pollResource } from "../utils/polling.js";
import { M2MGatewayAppContext } from "../utils/context.js";

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
        // TODO consider making checkFn optional, not needed in case we look for version 0
        // because it just means that the resource exists
        checkFn: (polled) => {
          console.log(polled); // TODO remove this after debugging
          return (
            polled.metadata?.version !== undefined &&
            polled.metadata.version >= 0
          );
        },
      });

      // TODO create a converter from delegationApi.Delegation to m2mGatewayApi.ConsumerDelegation
      return {
        id: polledResource.data.id,
        delegatorId: polledResource.data.delegatorId,
        delegateId: polledResource.data.delegateId,
        eserviceId: polledResource.data.eserviceId,
        createdAt: polledResource.data.createdAt,
        updatedAt: polledResource.data.updatedAt,
        rejectionReason: polledResource.data.rejectionReason,
        revokedAt: polledResource.data.revokedAt,
        state: polledResource.data.state,
        activationContract: polledResource.data.activationContract,
        revocationContract: polledResource.data.revocationContract,
        stamps: polledResource.data.stamps,
      };
    },
  };
}
