import {
  clientJwkKeyInReadmodelClientJwkKey,
  DrizzleReturnType,
} from "pagopa-interop-readmodel-models";
import { and, eq, lte } from "drizzle-orm";
import { ClientId, ClientJWKKey } from "pagopa-interop-models";
import {
  checkMetadataVersionByFilter,
  splitClientJWKKeyIntoObjectsSQL,
} from "pagopa-interop-readmodel";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function clientJWKKeyWriterServiceBuilder(db: DrizzleReturnType) {
  return {
    async upsertClientJWKKey(
      clientJWKKey: ClientJWKKey,
      metadataVersion: number
    ): Promise<void> {
      await db.transaction(async (tx) => {
        const shouldUpsert = await checkMetadataVersionByFilter(
          tx,
          clientJwkKeyInReadmodelClientJwkKey,
          metadataVersion,
          and(
            eq(clientJwkKeyInReadmodelClientJwkKey.kid, clientJWKKey.kid),
            eq(
              clientJwkKeyInReadmodelClientJwkKey.clientId,
              clientJWKKey.clientId
            )
          )
        );

        if (!shouldUpsert) {
          return;
        }

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
      });
    },

    async deleteClientJWKKeyByClientIdAndKid(
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

    async deleteClientJWKKeysByClientId(
      clientId: ClientId,
      metadataVersion: number
    ): Promise<void> {
      await db
        .delete(clientJwkKeyInReadmodelClientJwkKey)
        .where(
          and(
            eq(clientJwkKeyInReadmodelClientJwkKey.clientId, clientId),
            lte(
              clientJwkKeyInReadmodelClientJwkKey.metadataVersion,
              metadataVersion
            )
          )
        );
    },
  };
}
export type ClientJWKKeyWriterService = ReturnType<
  typeof clientJWKKeyWriterServiceBuilder
>;
