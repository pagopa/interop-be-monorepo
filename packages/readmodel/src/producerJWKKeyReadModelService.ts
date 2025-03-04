import { eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import {
  ProducerJWKKey,
  ProducerKeychainId,
  WithMetadata,
} from "pagopa-interop-models";
import { producerJwkKeyInReadmodelProducerJwkKey } from "pagopa-interop-readmodel-models";
import { splitProducerJWKKeyIntoObjectsSQL } from "./authorization/producerJWKKeySplitters.js";
import {
  aggregateProducerJWKKey,
  aggregateProducerJWKKeyArray,
} from "./authorization/producerJWKKeyAggregators.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function producerJWKKeyreadModelServiceBuilder(
  db: ReturnType<typeof drizzle>
) {
  return {
    async upsertProducerJWKKey(
      jwkKey: WithMetadata<ProducerJWKKey>
    ): Promise<void> {
      const producerJWKKeySQL = splitProducerJWKKeyIntoObjectsSQL(
        jwkKey.data,
        jwkKey.metadata.version
      );

      await db.transaction(async (tx) => {
        await tx
          .delete(producerJwkKeyInReadmodelProducerJwkKey)
          .where(
            and(
              eq(
                producerJwkKeyInReadmodelProducerJwkKey.producerKeychainId,
                jwkKey.data.producerKeychainId
              ),
              eq(producerJwkKeyInReadmodelProducerJwkKey.kid, jwkKey.data.kid)
            )
          );

        await tx
          .insert(producerJwkKeyInReadmodelProducerJwkKey)
          .values(producerJWKKeySQL);
      });
    },
    async getProducerJWKKeyByKid(
      producerKeychainId: ProducerKeychainId,
      kid: string
    ): Promise<WithMetadata<ProducerJWKKey> | undefined> {
      const queryResult = await db
        .select()
        .from(producerJwkKeyInReadmodelProducerJwkKey)
        .where(
          and(
            eq(
              producerJwkKeyInReadmodelProducerJwkKey.producerKeychainId,
              producerKeychainId
            ),
            eq(producerJwkKeyInReadmodelProducerJwkKey.kid, kid)
          )
        );
      if (queryResult.length === 0) {
        return undefined;
      }
      return aggregateProducerJWKKey(queryResult[0]);
    },
    async deleteProducerJWKKeyByKid(
      producerKeychainId: ProducerKeychainId,
      kid: string
    ): Promise<void> {
      await db
        .delete(producerJwkKeyInReadmodelProducerJwkKey)
        .where(
          and(
            eq(
              producerJwkKeyInReadmodelProducerJwkKey.producerKeychainId,
              producerKeychainId
            ),
            eq(producerJwkKeyInReadmodelProducerJwkKey.kid, kid)
          )
        );
    },
    async getAllProducerJWKKeys(): Promise<
      Array<WithMetadata<ProducerJWKKey>>
    > {
      const queryResult = await db
        .select()
        .from(producerJwkKeyInReadmodelProducerJwkKey);

      return aggregateProducerJWKKeyArray(queryResult);
    },
  };
}

export type ProducerJWKKeyReadModelService = ReturnType<
  typeof producerJWKKeyreadModelServiceBuilder
>;
