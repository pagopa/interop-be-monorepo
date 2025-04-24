import { delegationApi, m2mGatewayApi } from "pagopa-interop-api-clients";
import { WithLogger } from "pagopa-interop-commons";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import {
  isPolledVersionAtLeastResponseVersion,
  pollResource,
} from "../utils/polling.js";
import { M2MGatewayAppContext } from "../utils/context.js";
import {
  toGetDelegationsApiQueryParams,
  toM2MGatewayApiConsumerDelegation,
} from "../api/delegationApiConverter.js";
import { assertDelegationKindIs } from "../utils/validators/delegationValidators.js";
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
    async getConsumerDelegations(
      params: m2mGatewayApi.GetConsumerDelegationsQueryParams,
      { headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.ConsumerDelegations> {
      const response =
        await clients.delegationProcessClient.delegation.getDelegations({
          queries: toGetDelegationsApiQueryParams(params),
          headers,
        });

      const results = response.data.results.map((delegation) => {
        assertDelegationKindIs(
          delegation,
          delegationApi.DelegationKind.Values.DELEGATED_CONSUMER
        );
        return toM2MGatewayApiConsumerDelegation(delegation);
      });

      return {
        pagination: {
          limit: params.limit,
          offset: params.offset,
          totalCount: response.data.totalCount,
        },
        results,
      };
    },
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

      assertDelegationKindIs(
        polledResource.data,
        delegationApi.DelegationKind.Values.DELEGATED_CONSUMER
      );
      return toM2MGatewayApiConsumerDelegation(polledResource.data);
    },
  };
}
