import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { ClientId, ClientJWKKey, WithMetadata } from "pagopa-interop-models";
import { clientJwkKeyInReadmodelClientJwkKey } from "pagopa-interop-readmodel-models";
import { splitClientJWKKeyIntoObjectsSQL } from "./authorization/clientJWKKeySplitters.js";
import { aggregateClientJWKKey } from "./authorization/clientJWKKeyAggregators.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilder(db: ReturnType<typeof drizzle>) {
  return {
    async addClientJWKKey(
      clientJWKKey: WithMetadata<ClientJWKKey>
    ): Promise<void> {
      const clientJWKKeySQL = splitClientJWKKeyIntoObjectsSQL(
        clientJWKKey.data,
        clientJWKKey.metadata.version
      );

      await db
        .insert(clientJwkKeyInReadmodelClientJwkKey)
        .values(clientJWKKeySQL);
    },
    async getClientJWKKeyById(
      clientId: ClientId
    ): Promise<WithMetadata<ClientJWKKey>> {
      const queryResult = await db
        .select()
        .from(clientJwkKeyInReadmodelClientJwkKey)
        .where(eq(clientJwkKeyInReadmodelClientJwkKey.clientId, clientId))
        .limit(1);

      return aggregateClientJWKKey(queryResult[0]);
    },
    async deleteClientJWKKeyById(clientId: ClientId): Promise<void> {
      await db
        .delete(clientJwkKeyInReadmodelClientJwkKey)
        .where(eq(clientJwkKeyInReadmodelClientJwkKey.clientId, clientId));
    },
  };
}

export type ReadModelService = ReturnType<typeof readModelServiceBuilder>;
