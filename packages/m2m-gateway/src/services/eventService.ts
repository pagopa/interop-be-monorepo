import { WithLogger } from "pagopa-interop-commons";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { M2MGatewayAppContext } from "../utils/context.js";

export type EventService = ReturnType<typeof eventServiceBuilder>;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function eventServiceBuilder(clients: PagoPAInteropBeClients) {
  return {
    async getAttributeEvents(
      {
        lastEventId,
        limit,
      }: m2mGatewayApi.GetEventManagerAttributesQueryParams,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.AttributeEvents> {
      logger.info(`Retrieving attribute events`);

      const { events } = await clients.eventManagerClient.getAttributeM2MEvents(
        {
          queries: {
            lastEventId,
            limit,
          },
          headers,
        }
      );

      return { events };
    },
    async getProducerDelegationEvents(
      {
        lastEventId,
        limit,
      }: m2mGatewayApi.GetEventManagerProducerDelegationsQueryParams,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.ProducerDelegationEvents> {
      logger.info(`Retrieving producer delegation events`);

      const { events } =
        await clients.eventManagerClient.getProducerDelegationM2MEvents({
          queries: {
            lastEventId,
            limit,
          },
          headers,
        });

      return { events };
    },
    async getConsumerDelegationEvents(
      {
        lastEventId,
        limit,
      }: m2mGatewayApi.GetEventManagerConsumerDelegationsQueryParams,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.ConsumerDelegationEvents> {
      logger.info(`Retrieving consumer delegation events`);

      const { events } =
        await clients.eventManagerClient.getConsumerDelegationM2MEvents({
          queries: {
            lastEventId,
            limit,
          },
          headers,
        });

      return { events };
    },
  };
}
