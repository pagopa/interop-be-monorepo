import { WithLogger } from "pagopa-interop-commons";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { M2MGatewayAppContext } from "../utils/context.js";
import {
  toM2MGatewayApiAttributeEvent,
  toM2MGatewayApiEServiceTemplateEvent,
} from "../api/eventApiConverter.js";

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
  };
}
