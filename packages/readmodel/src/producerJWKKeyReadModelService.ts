import { eq, and, lte, SQL } from "drizzle-orm";
import {
  genericInternalError,
  ProducerJWKKey,
  ProducerKeychainId,
  WithMetadata,
} from "pagopa-interop-models";
import {
  DrizzleReturnType,
  producerJwkKeyInReadmodelProducerJwkKey,
} from "pagopa-interop-readmodel-models";
import { splitProducerJWKKeyIntoObjectsSQL } from "./authorization/producerJWKKeySplitters.js";
import { aggregateProducerJWKKey } from "./authorization/producerJWKKeyAggregators.js";
import { checkMetadataVersionByFilter } from "./index.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function producerJWKKeyReadModelServiceBuilder(db: DrizzleReturnType) {
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
          eq(producerJwkKeyInReadmodelProducerJwkKey.kid, jwkKey.kid)
        );

        if (shouldUpsert) {
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
        }
      });
    },
    async getProducerJWKKeyByProducerKeychainIdAndKid(
      producerKeychainId: ProducerKeychainId,
      kid: string
    ): Promise<WithMetadata<ProducerJWKKey> | undefined> {
      return this.getProducerJWKKeyByFilter(
        and(
          eq(
            producerJwkKeyInReadmodelProducerJwkKey.producerKeychainId,
            producerKeychainId
          ),
          eq(producerJwkKeyInReadmodelProducerJwkKey.kid, kid)
        )
      );
    },
    async getProducerJWKKeyByFilter(
      filter: SQL | undefined
    ): Promise<WithMetadata<ProducerJWKKey> | undefined> {
      if (filter === undefined) {
        throw genericInternalError("Filter cannot be undefined");
      }
      const queryResult = await db
        .select()
        .from(producerJwkKeyInReadmodelProducerJwkKey)
        .where(filter);
      if (queryResult.length === 0) {
        return undefined;
      }
      return aggregateProducerJWKKey(queryResult[0]);
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
  };
}

export type ProducerJWKKeyReadModelService = ReturnType<
  typeof producerJWKKeyReadModelServiceBuilder
>;
