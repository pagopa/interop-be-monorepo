import { WithLogger } from "pagopa-interop-commons";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { M2MGatewayAppContext } from "../utils/context.js";
import {
  toM2MGatewayApiAgreementEvent,
  toM2MGatewayApiAttributeEvent,
  toM2MGatewayApiEServiceEvent,
  toM2MGatewayApiConsumerDelegationEvent,
  toM2MGatewayApiProducerDelegationEvent,
  toM2MGatewayApiClientEvent,
  toM2MGatewayApiKeyEvent,
  toM2MGatewayApiProducerKeychainsEvent,
  toM2MGatewayApiProducerKeysEvent,
  toM2MGatewayApiEServiceTemplateEvent,
  toM2MGatewayApiTenantEvent,
  toM2MGatewayApiPurposeEvent,
} from "../api/eventApiConverter.js";

export type EventService = ReturnType<typeof eventServiceBuilder>;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function eventServiceBuilder(clients: PagoPAInteropBeClients) {
  return {
    async getEServiceEvents(
      {
        lastEventId,
        limit,
        delegationId,
      }: m2mGatewayApi.GetEventManagerEServicesQueryParams,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.EServiceEvents> {
      logger.info(
        `Retrieving eservice events with lastEventId ${lastEventId}, limit ${limit} and delegationId ${delegationId}`
      );

      const { events } = await clients.eventManagerClient.getEServiceM2MEvents({
        queries: {
          lastEventId,
          limit,
          delegationId,
        },
        headers,
      });

      return { events: events.map(toM2MGatewayApiEServiceEvent) };
    },
    async getAttributeEvents(
      {
        lastEventId,
        limit,
      }: m2mGatewayApi.GetEventManagerAttributesQueryParams,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.AttributeEvents> {
      logger.info(
        `Retrieving attribute events with lastEventId: ${lastEventId} and limit: ${limit}`
      );

      const { events } = await clients.eventManagerClient.getAttributeM2MEvents(
        {
          queries: {
            lastEventId,
            limit,
          },
          headers,
        }
      );

      return { events: events.map(toM2MGatewayApiAttributeEvent) };
    },

    async getPurposeEvents(
      {
        lastEventId,
        limit,
        delegationId,
      }: m2mGatewayApi.GetEventManagerPurposesQueryParams,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.PurposeEvents> {
      logger.info(
        `Retrieving purpose events with lastEventId: ${lastEventId} and limit: ${limit} and delegationId ${delegationId}`
      );

      const { events } = await clients.eventManagerClient.getPurposeM2MEvents({
        queries: {
          lastEventId,
          limit,
          delegationId,
        },
        headers,
      });
      return { events: events.map(toM2MGatewayApiPurposeEvent) };
    },

    async getTenantEvents(
      {
        lastEventId,
        limit,
      }: m2mGatewayApi.GetEventManagerTenantEventsQueryParams,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.TenantEvents> {
      logger.info(
        `Retrieving tenant events with lastEventId: ${lastEventId} and limit: ${limit}`
      );

      const { events } = await clients.eventManagerClient.getTenantM2MEvents({
        queries: {
          lastEventId,
          limit,
        },
        headers,
      });
      return { events: events.map(toM2MGatewayApiTenantEvent) };
    },

    async getKeyEvents(
      { lastEventId, limit }: m2mGatewayApi.GetEventManagerKeysQueryParams,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.KeyEvents> {
      logger.info(
        `Retrieving key events with lastEventId: ${lastEventId} and limit: ${limit}`
      );

      const { events } = await clients.eventManagerClient.getKeyM2MEvents({
        queries: {
          lastEventId,
          limit,
        },
        headers,
      });

      return { events: events.map(toM2MGatewayApiKeyEvent) };
    },
    async getClientEvents(
      { lastEventId, limit }: m2mGatewayApi.GetEventManagerClientQueryParams,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.ClientEvents> {
      logger.info(`Retrieving client events`);

      const { events } = await clients.eventManagerClient.getClientM2MEvents({
        queries: {
          lastEventId,
          limit,
        },
        headers,
      });

      return { events: events.map(toM2MGatewayApiClientEvent) };
    },
    async getProducerKeyEvents(
      {
        lastEventId,
        limit,
      }: m2mGatewayApi.GetEventManagerProducerKeyEventsQueryParams,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.ProducerKeyEvents> {
      logger.info(
        `Retrieving producer key events with lastEventId: ${lastEventId} and limit: ${limit}`
      );

      const { events } =
        await clients.eventManagerClient.getProducerKeyM2MEvents({
          queries: {
            lastEventId,
            limit,
          },
          headers,
        });

      return { events: events.map(toM2MGatewayApiProducerKeysEvent) };
    },
    async getProducerKeychainEvents(
      {
        lastEventId,
        limit,
      }: m2mGatewayApi.GetEventManagerProducerKeychainEventsQueryParams,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.ProducerKeychainEvents> {
      logger.info(
        `Retrieving producer keychain events with lastEventId: ${lastEventId} and limit: ${limit}`
      );

      const { events } =
        await clients.eventManagerClient.getProducerKeychainM2MEvents({
          queries: {
            lastEventId,
            limit,
          },
          headers,
        });

      return { events: events.map(toM2MGatewayApiProducerKeychainsEvent) };
    },
    async getEServiceTemplateEvents(
      {
        lastEventId,
        limit,
      }: m2mGatewayApi.GetEventManagerEServiceTemplatesQueryParams,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.EServiceTemplateEvents> {
      logger.info(
        `Retrieving eservice template events with lastEventId: ${lastEventId} and limit: ${limit}`
      );

      const { events } =
        await clients.eventManagerClient.getEServiceTemplateM2MEvents({
          queries: {
            lastEventId,
            limit,
          },
          headers,
        });
      return { events: events.map(toM2MGatewayApiEServiceTemplateEvent) };
    },
    async getAgreementEvents(
      {
        lastEventId,
        limit,
        delegationId,
      }: m2mGatewayApi.GetEventManagerAgreementsQueryParams,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.AgreementEvents> {
      logger.info(
        `Retrieving agreement events with lastEventId: ${lastEventId}, limit: ${limit} and delegationId: ${delegationId}`
      );

      const { events } = await clients.eventManagerClient.getAgreementM2MEvents(
        {
          queries: {
            lastEventId,
            limit,
            delegationId,
          },
          headers,
        }
      );

      return { events: events.map(toM2MGatewayApiAgreementEvent) };
    },

    async getProducerDelegationEvents(
      {
        lastEventId,
        limit,
      }: m2mGatewayApi.GetEventManagerProducerDelegationsQueryParams,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.ProducerDelegationEvents> {
      logger.info(
        `Retrieving producer delegation events with lastEventId: ${lastEventId} and limit: ${limit}`
      );

      const { events } =
        await clients.eventManagerClient.getProducerDelegationM2MEvents({
          queries: {
            lastEventId,
            limit,
          },
          headers,
        });

      return { events: events.map(toM2MGatewayApiProducerDelegationEvent) };
    },
    async getConsumerDelegationEvents(
      {
        lastEventId,
        limit,
      }: m2mGatewayApi.GetEventManagerConsumerDelegationsQueryParams,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.ConsumerDelegationEvents> {
      logger.info(
        `Retrieving consumer delegation events with lastEventId: ${lastEventId} and limit: ${limit}`
      );

      const { events } =
        await clients.eventManagerClient.getConsumerDelegationM2MEvents({
          queries: {
            lastEventId,
            limit,
          },
          headers,
        });

      return { events: events.map(toM2MGatewayApiConsumerDelegationEvent) };
    },
  };
}
