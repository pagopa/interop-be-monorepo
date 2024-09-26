import { apiGatewayApi } from "pagopa-interop-api-clients";
import { WithLogger } from "pagopa-interop-commons";
import { NotifierEventsClient } from "../clients/clientsProvider.js";
import { ApiGatewayAppContext } from "../utilities/context.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function notifierEventsServiceBuilder(
  notifierEventsClient: NotifierEventsClient
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

      return await notifierEventsClient.getEventsFromId({
        headers,
        queries: {
          lastEventId,
          limit,
        },
      });
    },
    getEservicesEventsFromId: async (
      { logger, headers }: WithLogger<ApiGatewayAppContext>,
      lastEventId: number,
      limit: number
    ): Promise<apiGatewayApi.Events> => {
      logger.info(
        `Retrieving EServices Notifier Events - lastEventId: ${lastEventId} - limit ${limit}`
      );

      return await notifierEventsClient.getAllEservicesFromId({
        headers,
        queries: {
          lastEventId,
          limit,
        },
      });
    },
    getAgreementsEventsFromId: async (
      { logger, headers }: WithLogger<ApiGatewayAppContext>,
      lastEventId: number,
      limit: number
    ): Promise<apiGatewayApi.Events> => {
      logger.info(
        `Retrieving Agreements Notifier Events - lastEventId: ${lastEventId} - limit ${limit}`
      );

      return await notifierEventsClient.getAllAgreementsEventsFromId({
        headers,
        queries: {
          lastEventId,
          limit,
        },
      });
    },
    getKeysEventsFromId: async (
      { logger, headers }: WithLogger<ApiGatewayAppContext>,
      lastEventId: number,
      limit: number
    ): Promise<apiGatewayApi.Events> => {
      logger.info(
        `Retrieving Keys Notifier Events - lastEventId: ${lastEventId} - limit ${limit}`
      );

      return await notifierEventsClient.getKeysEvents({
        headers,
        queries: {
          lastEventId,
          limit,
        },
      });
    },
    getProducerKeysEventsFromId: async (
      { logger, headers }: WithLogger<ApiGatewayAppContext>,
      lastEventId: number,
      limit: number
    ): Promise<apiGatewayApi.Events> => {
      logger.info(
        `Retrieving Producer Keys Notifier Events - lastEventId: ${lastEventId} - limit ${limit}`
      );

      return await notifierEventsClient.getProducerKeysEvents({
        headers,
        queries: {
          lastEventId,
          limit,
        },
      });
    },
  };
}
