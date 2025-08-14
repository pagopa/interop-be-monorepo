import {
  DrizzleReturnType,
  producerJwkKeyInReadmodelProducerJwkKey,
} from "pagopa-interop-readmodel-models";
import { and, eq, lte } from "drizzle-orm";
import { ProducerJWKKey, ProducerKeychainId } from "pagopa-interop-models";
import {
  checkMetadataVersionByFilter,
  splitProducerJWKKeyIntoObjectsSQL,
} from "pagopa-interop-readmodel";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function producerJWKKeyWriterServiceBuilder(db: DrizzleReturnType) {
  return {
    async upsertProducerJWKKey(
      jwkKey: ProducerJWKKey,
      metadataVersion: number
    ): Promise<void> {
      await db.transaction(async (tx) => {
        const shouldUpsert = await checkMetadataVersionByFilter(
          tx,
          producerJwkKeyInReadmodelProducerJwkKey,
          metadataVersion,
          and(
            eq(producerJwkKeyInReadmodelProducerJwkKey.kid, jwkKey.kid),
            eq(
              producerJwkKeyInReadmodelProducerJwkKey.producerKeychainId,
              jwkKey.producerKeychainId
            )
          )
        );

        if (!shouldUpsert) {
          return;
        }

        await tx
          .delete(producerJwkKeyInReadmodelProducerJwkKey)
          .where(
            and(
              eq(
                producerJwkKeyInReadmodelProducerJwkKey.producerKeychainId,
                jwkKey.producerKeychainId
              ),
              eq(producerJwkKeyInReadmodelProducerJwkKey.kid, jwkKey.kid)
            )
          );

        const producerJWKKeySQL = splitProducerJWKKeyIntoObjectsSQL(
          jwkKey,
          metadataVersion
        );

        await tx
          .insert(producerJwkKeyInReadmodelProducerJwkKey)
          .values(producerJWKKeySQL);
      });
    },
    async deleteProducerJWKKeyByProducerKeychainAndKid(
      producerKeychainId: ProducerKeychainId,
      kid: string,
      metadataVersion: number
    ): Promise<void> {
      await db
        .delete(producerJwkKeyInReadmodelProducerJwkKey)
        .where(
          and(
            eq(
              producerJwkKeyInReadmodelProducerJwkKey.producerKeychainId,
              producerKeychainId
            ),
            eq(producerJwkKeyInReadmodelProducerJwkKey.kid, kid),
            lte(
              producerJwkKeyInReadmodelProducerJwkKey.metadataVersion,
              metadataVersion
            )
          )
        );
    },
    async deleteProducerJWKKeysByProducerKeychainId(
      producerKeychainId: ProducerKeychainId,
      metadataVersion: number
    ): Promise<void> {
      await db
        .delete(producerJwkKeyInReadmodelProducerJwkKey)
        .where(
          and(
            eq(
              producerJwkKeyInReadmodelProducerJwkKey.producerKeychainId,
              producerKeychainId
            ),
            lte(
              producerJwkKeyInReadmodelProducerJwkKey.metadataVersion,
              metadataVersion
            )
          )
        );
    },
  };
}
export type ProducerJWKKeyWriterService = ReturnType<
  typeof producerJWKKeyWriterServiceBuilder
>;
