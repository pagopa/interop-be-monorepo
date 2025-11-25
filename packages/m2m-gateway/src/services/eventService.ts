import { WithLogger } from "pagopa-interop-commons";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { M2MGatewayAppContext } from "../utils/context.js";
import {
  toM2MGatewayApiAttributeEvent,
  toM2MGatewayApiEServiceEvent,
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
        `Retrieving eservice events with lastEventId: ${lastEventId} and limit: ${limit}`
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
    async getAgreementEvents(
      {
        lastEventId,
        limit,
        delegationId,
      }: m2mGatewayApi.GetEventManagerAgreementsQueryParams,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.AgreementEvents> {
      logger.info(`Retrieving agreement events with lastEventId: ${lastEventId} and limit: ${limit}`);

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

      return { events };
    },
  };
}
