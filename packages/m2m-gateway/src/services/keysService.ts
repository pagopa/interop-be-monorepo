import { WithLogger } from "pagopa-interop-commons";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { toM2MKey, toM2MProducerKey } from "../api/keysApiConverter.js";
import { M2MGatewayAppContext } from "../utils/context.js";

export type KeysService = ReturnType<typeof keysServiceBuilder>;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function keysServiceBuilder(clients: PagoPAInteropBeClients) {
  return {
    async getKey(
      kid: string,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.Key> {
      logger.info(`Retrieving key with id ${kid}`);

      const key = await clients.authorizationClient.keys.getJWKByKid({
        headers,
        params: { kid },
      });
      return toM2MKey(key.data);
    },
    async getProducerKey(
      kid: string,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.ProducerKey> {
      logger.info(`Retrieving producer key with id ${kid}`);

      const key = await clients.authorizationClient.keys.getProducerJWKByKid({
        headers,
        params: { kid },
      });
      return toM2MProducerKey(key.data);
    },
  };
}
