import { apiGatewayApi, notifierApi } from "pagopa-interop-api-clients";
import { WithLogger } from "pagopa-interop-commons";
import { ApiGatewayAppContext } from "../utilities/context.js";
import { notifierEventsToApiGatewayEvents } from "../api/eventsApiConverter.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function notifierEventsServiceBuilder(
  notifierEventsClient: notifierApi.NotifierEventsClient
) {
  return {
    getEventsFromId: async (
      { logger, headers }: WithLogger<ApiGatewayAppContext>,
      lastEventId: number,
      limit: number
    ): Promise<apiGatewayApi.Events> => {
      logger.info(
        `Retrieving Notifier Events - lastEventId: ${lastEventId} - limit ${limit}`
      );

      const events = await notifierEventsClient.getEventsFromId({
        headers,
        queries: {
          lastEventId,
          limit,
        },
      });

      return notifierEventsToApiGatewayEvents(events);
    },
    getEservicesEventsFromId: async (
      { logger, headers }: WithLogger<ApiGatewayAppContext>,
      lastEventId: number,
      limit: number
    ): Promise<apiGatewayApi.Events> => {
      logger.info(
        `Retrieving EServices Notifier Events - lastEventId: ${lastEventId} - limit ${limit}`
      );

      const events = await notifierEventsClient.getAllEservicesFromId({
        headers,
        queries: {
          lastEventId,
          limit,
        },
      });

      return notifierEventsToApiGatewayEvents(events);
    },
    getAgreementsEventsFromId: async (
      { logger, headers }: WithLogger<ApiGatewayAppContext>,
      lastEventId: number,
      limit: number
    ): Promise<apiGatewayApi.Events> => {
      logger.info(
        `Retrieving Agreements Notifier Events - lastEventId: ${lastEventId} - limit ${limit}`
      );

      const events = await notifierEventsClient.getAllAgreementsEventsFromId({
        headers,
        queries: {
          lastEventId,
          limit,
        },
      });

      return notifierEventsToApiGatewayEvents(events);
    },
    getKeysEventsFromId: async (
      { logger, headers }: WithLogger<ApiGatewayAppContext>,
      lastEventId: number,
      limit: number
    ): Promise<apiGatewayApi.Events> => {
      logger.info(
        `Retrieving Keys Notifier Events - lastEventId: ${lastEventId} - limit ${limit}`
      );

      const events = await notifierEventsClient.getKeysEvents({
        headers,
        queries: {
          lastEventId,
          limit,
        },
      });

      return notifierEventsToApiGatewayEvents(events);
    },
    getProducerKeysEventsFromId: async (
      { logger, headers }: WithLogger<ApiGatewayAppContext>,
      lastEventId: number,
      limit: number
    ): Promise<apiGatewayApi.Events> => {
      logger.info(
        `Retrieving Producer Keys Notifier Events - lastEventId: ${lastEventId} - limit ${limit}`
      );

      const events = await notifierEventsClient.getProducerKeysEvents({
        headers,
        queries: {
          lastEventId,
          limit,
        },
      });

      return notifierEventsToApiGatewayEvents(events);
    },
  };
}
