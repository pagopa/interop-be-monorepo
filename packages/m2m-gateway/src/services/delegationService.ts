import { delegationApi, m2mGatewayApi } from "pagopa-interop-api-clients";
import { WithLogger } from "pagopa-interop-commons";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import {
  isPolledVersionAtLeastResponseVersion,
  pollResourceWithMetadata,
} from "../utils/polling.js";
import { M2MGatewayAppContext } from "../utils/context.js";
import {
  toGetConsumerDelegationsApiQueryParams,
  toM2MGatewayApiConsumerDelegation,
} from "../api/delegationApiConverter.js";
import { WithMaybeMetadata } from "../clients/zodiosWithMetadataPatch.js";

export type DelegationService = ReturnType<typeof delegationServiceBuilder>;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function delegationServiceBuilder(clients: PagoPAInteropBeClients) {
  const pollDelegation = (
    response: WithMaybeMetadata<delegationApi.Delegation>,
    headers: M2MGatewayAppContext["headers"]
  ): Promise<WithMaybeMetadata<delegationApi.Delegation>> =>
    pollResourceWithMetadata(() =>
      clients.delegationProcessClient.delegation.getDelegation({
        params: { delegationId: response.data.id },
        headers,
      })
    )({
      condition: isPolledVersionAtLeastResponseVersion(response),
    });

  return {
    async getConsumerDelegations(
      params: m2mGatewayApi.GetConsumerDelegationsQueryParams,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.ConsumerDelegations> {
      logger.info(
        `Retrieving delegations for states ${params.states} delegatorIds ${params.delegatorIds} delegateIds ${params.delegateIds} eserviceIds ${params.eserviceIds} offset ${params.offset} limit ${params.limit}`
      );

      const response =
        await clients.delegationProcessClient.delegation.getDelegations({
          queries: toGetConsumerDelegationsApiQueryParams(params),
          headers,
        });

      const results = response.data.results.map(
        toM2MGatewayApiConsumerDelegation
      );

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
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.ConsumerDelegation> {
      logger.info(
        `Creating consumer delegation for eservice ${seed.eserviceId} and delegateId ${seed.delegateId}`
      );

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
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.ConsumerDelegation> {
      logger.info(`Rejecting consumer delegation with id ${delegationId}`);

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
    async acceptConsumerDelegation(
      delegationId: string,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.ConsumerDelegation> {
      logger.info(`Accepting consumer delegation with id ${delegationId}`);

      const response =
        await clients.delegationProcessClient.consumer.approveConsumerDelegation(
          undefined,
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
