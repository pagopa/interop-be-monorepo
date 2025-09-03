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
  toGetProducerDelegationsApiQueryParams,
  toM2MGatewayApiConsumerDelegation,
  toM2MGatewayApiProducerDelegation,
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
        `Retrieving consumer delegations for states ${params.states} delegatorIds ${params.delegatorIds} delegateIds ${params.delegateIds} eserviceIds ${params.eserviceIds} offset ${params.offset} limit ${params.limit}`
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
    async getProducerDelegations(
      params: m2mGatewayApi.GetProducerDelegationsQueryParams,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.ProducerDelegations> {
      logger.info(
        `Retrieving producer delegations for states ${params.states} delegatorIds ${params.delegatorIds} delegateIds ${params.delegateIds} eserviceIds ${params.eserviceIds} offset ${params.offset} limit ${params.limit}`
      );

      const response =
        await clients.delegationProcessClient.delegation.getDelegations({
          queries: toGetProducerDelegationsApiQueryParams(params),
          headers,
        });

      const results = response.data.results.map(
        toM2MGatewayApiProducerDelegation
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
    async acceptProducerDelegation(
      delegationId: string,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.ProducerDelegation> {
      logger.info(`Accepting producer delegation with id ${delegationId}`);

      const response =
        await clients.delegationProcessClient.producer.approveProducerDelegation(
          undefined,
          {
            params: {
              delegationId,
            },
            headers,
          }
        );

      const polledResource = await pollDelegation(response, headers);

      return toM2MGatewayApiProducerDelegation(polledResource.data);
    },
    async rejectProducerDelegation(
      delegationId: string,
      { rejectionReason }: m2mGatewayApi.DelegationRejection,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.ProducerDelegation> {
      logger.info(`Rejecting producer delegation with id ${delegationId}`);

      const response =
        await clients.delegationProcessClient.producer.rejectProducerDelegation(
          { rejectionReason },
          {
            params: {
              delegationId,
            },
            headers,
          }
        );

      const polledResource = await pollDelegation(response, headers);

      return toM2MGatewayApiProducerDelegation(polledResource.data);
    },
    async createProducerDelegation(
      seed: m2mGatewayApi.DelegationSeed,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.ProducerDelegation> {
      logger.info(
        `Creating producer delegation for eservice ${seed.eserviceId} and delegateId ${seed.delegateId}`
      );

      const response =
        await clients.delegationProcessClient.producer.createProducerDelegation(
          seed,
          {
            headers,
          }
        );

      const polledResource = await pollDelegation(response, headers);

      return toM2MGatewayApiProducerDelegation(polledResource.data);
    },
    async getConsumerDelegation(
      delegationId: string,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.ConsumerDelegation> {
      logger.info(`Retrieving consumer delegation with id ${delegationId}`);

      const response =
        await clients.delegationProcessClient.delegation.getDelegation({
          params: { delegationId },
          headers,
        });

      return toM2MGatewayApiConsumerDelegation(response.data);
    },
    async getProducerDelegation(
      delegationId: string,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.ProducerDelegation> {
      logger.info(`Retrieving producer delegation with id ${delegationId}`);

      const response =
        await clients.delegationProcessClient.delegation.getDelegation({
          params: { delegationId },
          headers,
        });

      return toM2MGatewayApiProducerDelegation(response.data);
    },
  };
}
