import { and, eq, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { ClientId, ClientJWKKey, WithMetadata } from "pagopa-interop-models";
import { clientJwkKeyInReadmodelClientJwkKey } from "pagopa-interop-readmodel-models";
import { splitClientJWKKeyIntoObjectsSQL } from "./authorization/clientJWKKeySplitters.js";
import { aggregateClientJWKKey } from "./authorization/clientJWKKeyAggregators.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function clientJWKKeyReadModelServiceBuilder(
  db: ReturnType<typeof drizzle>
) {
  return {
    async upsertClientJWKKey(
      clientJWKKey: ClientJWKKey,
      metadataVersion: number
    ): Promise<void> {
      await db.transaction(async (tx) => {
        const existingMetadataVersion: number | undefined = (
          await tx
            .select({
              metadataVersion:
                clientJwkKeyInReadmodelClientJwkKey.metadataVersion,
            })
            .from(clientJwkKeyInReadmodelClientJwkKey)
            .where(
              and(
                eq(
                  clientJwkKeyInReadmodelClientJwkKey.clientId,
                  clientJWKKey.clientId
                ),
                eq(clientJwkKeyInReadmodelClientJwkKey.kid, clientJWKKey.kid)
              )
            )
        )[0]?.metadataVersion;

        if (
          !existingMetadataVersion ||
          existingMetadataVersion <= metadataVersion
        ) {
          await tx
            .delete(clientJwkKeyInReadmodelClientJwkKey)
            .where(
              and(
                eq(
                  clientJwkKeyInReadmodelClientJwkKey.clientId,
                  clientJWKKey.clientId
                ),
                eq(clientJwkKeyInReadmodelClientJwkKey.kid, clientJWKKey.kid)
              )
            );

          const clientJWKKeySQL = splitClientJWKKeyIntoObjectsSQL(
            clientJWKKey,
            metadataVersion
          );

          await tx
            .insert(clientJwkKeyInReadmodelClientJwkKey)
            .values(clientJWKKeySQL);
        }
      });
    },
    async getClientJWKKeyByKid(
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
        );

      if (queryResult.length === 0) {
        return undefined;
      }

      return aggregateClientJWKKey(queryResult[0]);
    },
    async deleteClientJWKKeyById(
      clientId: ClientId,
      kid: string,
      metadataVersion: number
    ): Promise<void> {
      await db
        .delete(clientJwkKeyInReadmodelClientJwkKey)
        .where(
          and(
            eq(clientJwkKeyInReadmodelClientJwkKey.clientId, clientId),
            eq(clientJwkKeyInReadmodelClientJwkKey.kid, kid),
            lte(
              clientJwkKeyInReadmodelClientJwkKey.metadataVersion,
              metadataVersion
            )
          )
        );
    },
  };
}

export type ClientJWKKeyReadModelService = ReturnType<
  typeof clientJWKKeyReadModelServiceBuilder
>;
