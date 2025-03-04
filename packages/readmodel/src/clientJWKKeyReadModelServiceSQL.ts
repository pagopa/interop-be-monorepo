import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { ClientId, ClientJWKKey, WithMetadata } from "pagopa-interop-models";
import { clientJwkKeyInReadmodelClientJwkKey } from "pagopa-interop-readmodel-models";
import { splitClientJWKKeyIntoObjectsSQL } from "./authorization/clientJWKKeySplitters.js";
import {
  aggregateClientJWKKey,
  aggregateClientJWKKeyArray,
} from "./authorization/clientJWKKeyAggregators.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function clientJWKKeyReadModelServiceBuilder(
  db: ReturnType<typeof drizzle>
) {
  return {
    async upsertClientJWKKey(
      clientJWKKey: WithMetadata<ClientJWKKey>
    ): Promise<void> {
      const clientJWKKeySQL = splitClientJWKKeyIntoObjectsSQL(
        clientJWKKey.data,
        clientJWKKey.metadata.version
      );
      await db.transaction(async (tx) => {
        await tx
          .delete(clientJwkKeyInReadmodelClientJwkKey)
          .where(
            eq(
              clientJwkKeyInReadmodelClientJwkKey.clientId,
              clientJWKKey.data.clientId
            )
          );
        await tx
          .insert(clientJwkKeyInReadmodelClientJwkKey)
          .values(clientJWKKeySQL);
      });
    },
    async getClientJWKKeyById(
      clientId: ClientId,
      kid: string
    ): Promise<WithMetadata<ClientJWKKey> | undefined> {
      const queryResult = await db
        .select()
        .from(clientJwkKeyInReadmodelClientJwkKey)
        .where(
          and(
            eq(clientJwkKeyInReadmodelClientJwkKey.clientId, clientId),
            eq(clientJwkKeyInReadmodelClientJwkKey.kid, kid)
          )
        )
        .limit(1);

      if (queryResult.length === 0) {
        return undefined;
      }

      return aggregateClientJWKKey(queryResult[0]);
    },
    async deleteClientJWKKeyById(
      clientId: ClientId,
      kid: string
    ): Promise<void> {
      await db
        .delete(clientJwkKeyInReadmodelClientJwkKey)
        .where(
          and(
            eq(clientJwkKeyInReadmodelClientJwkKey.clientId, clientId),
            eq(clientJwkKeyInReadmodelClientJwkKey.kid, kid)
          )
        );
    },
    async getAllClientJWKKeys(): Promise<Array<WithMetadata<ClientJWKKey>>> {
      const queryResult = await db
        .select()
        .from(clientJwkKeyInReadmodelClientJwkKey);

      return aggregateClientJWKKeyArray(queryResult);
    },
  };
}

export type ClientJWKKeyReadModelService = ReturnType<
  typeof clientJWKKeyReadModelServiceBuilder
>;
