import { WithLogger } from "pagopa-interop-commons";
import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
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

const normalizeDelegationId = (
  delegationId: string | null | undefined
): string | undefined => (delegationId === null ? "null" : delegationId);

export type EventService = ReturnType<typeof eventServiceBuilder>;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function eventServiceBuilder(clients: PagoPAInteropBeClients) {
  return {
    async getEServiceEvents(
      {
        lastEventId,
        limit,
        delegationId,
      }: m2mGatewayApiV3.GetEventManagerEServicesQueryParams,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApiV3.EServiceEvents> {
      logger.info(
        `Retrieving eservice events with lastEventId ${lastEventId}, limit ${limit} and delegationId ${delegationId}`
      );

      const { events } = await clients.eventManagerClient.getEServiceM2MEvents({
        queries: {
          lastEventId,
          limit,
          delegationId: normalizeDelegationId(delegationId),
        },
        headers,
      });

      return { events: events.map(toM2MGatewayApiEServiceEvent) };
    },
    async getAttributeEvents(
      {
        lastEventId,
        limit,
      }: m2mGatewayApiV3.GetEventManagerAttributesQueryParams,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApiV3.AttributeEvents> {
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
      }: m2mGatewayApiV3.GetEventManagerPurposesQueryParams,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApiV3.PurposeEvents> {
      logger.info(
        `Retrieving purpose events with lastEventId: ${lastEventId} and limit: ${limit} and delegationId ${delegationId}`
      );

      const { events } = await clients.eventManagerClient.getPurposeM2MEvents({
        queries: {
          lastEventId,
          limit,
          delegationId: normalizeDelegationId(delegationId),
        },
        headers,
      });
      return { events: events.map(toM2MGatewayApiPurposeEvent) };
    },

    async getTenantEvents(
      {
        lastEventId,
        limit,
      }: m2mGatewayApiV3.GetEventManagerTenantEventsQueryParams,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApiV3.TenantEvents> {
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
      { lastEventId, limit }: m2mGatewayApiV3.GetEventManagerKeysQueryParams,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApiV3.KeyEvents> {
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
      { lastEventId, limit }: m2mGatewayApiV3.GetEventManagerClientQueryParams,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApiV3.ClientEvents> {
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
      }: m2mGatewayApiV3.GetEventManagerProducerKeyEventsQueryParams,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApiV3.ProducerKeyEvents> {
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
      }: m2mGatewayApiV3.GetEventManagerProducerKeychainEventsQueryParams,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApiV3.ProducerKeychainEvents> {
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
      }: m2mGatewayApiV3.GetEventManagerEServiceTemplatesQueryParams,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApiV3.EServiceTemplateEvents> {
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
      }: m2mGatewayApiV3.GetEventManagerAgreementsQueryParams,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApiV3.AgreementEvents> {
      logger.info(
        `Retrieving agreement events with lastEventId: ${lastEventId}, limit: ${limit} and delegationId: ${delegationId}`
      );

      const { events } = await clients.eventManagerClient.getAgreementM2MEvents(
        {
          queries: {
            lastEventId,
            limit,
            delegationId: normalizeDelegationId(delegationId),
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
      }: m2mGatewayApiV3.GetEventManagerProducerDelegationsQueryParams,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApiV3.ProducerDelegationEvents> {
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
      }: m2mGatewayApiV3.GetEventManagerConsumerDelegationsQueryParams,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApiV3.ConsumerDelegationEvents> {
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
