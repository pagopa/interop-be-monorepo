import { WithLogger } from "pagopa-interop-commons";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { M2MGatewayAppContext } from "../utils/context.js";

export type EventService = ReturnType<typeof eventServiceBuilder>;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function eventServiceBuilder(clients: PagoPAInteropBeClients) {
  return {
    async getAttributeEvents({
      headers,
      logger,
    }: WithLogger<M2MGatewayAppContext>): Promise<m2mGatewayApi.AttributeEvents> {
      logger.info(`Retrieving attribute events`);

      const {
        data: { events },
      } = await clients.eventManagerClient.getAttributeM2MEvents({
        queries: {
          lastEventId: undefined,
          limit: 100,
        },
        headers,
      });

      return { events };
    },
  };
}
