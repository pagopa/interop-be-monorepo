import { delegationApi, m2mGatewayApi } from "pagopa-interop-api-clients";
import { WithLogger } from "pagopa-interop-commons";
import { DelegationId } from "pagopa-interop-models";
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
      const delegationToBeCreated =
        await delegationProcessClient.consumer.createConsumerDelegation(seed, {
          headers,
        });

      // TODO poll version after adding it to the getDelegation return body in delegation-process
      return await pollDelegation(
        delegationToBeCreated.id,
        headers
      )({ checkFn: (d) => d.id === delegationToBeCreated.id });
    },
  };
}
