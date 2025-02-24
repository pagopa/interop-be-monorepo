import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { ProducerJWKKey, WithMetadata } from "pagopa-interop-models";
import { producerJwkKeyInReadmodelProducerJwkKey } from "pagopa-interop-readmodel-models";
import { splitProducerJWKKeyIntoObjectsSQL } from "./authorization/producerJWKKeySplitters.js";
import { aggregateProducerJWKKey } from "./authorization/producerJWKKeyAggregators.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilder(db: ReturnType<typeof drizzle>) {
  return {
    async addProducerJWKKey(
      jwkKey: WithMetadata<ProducerJWKKey>
    ): Promise<void> {
      const producerJWKKeySQL = splitProducerJWKKeyIntoObjectsSQL(
        jwkKey.data,
        jwkKey.metadata.version
      );

      await db.transaction(async (tx) => {
        await tx
          .insert(producerJwkKeyInReadmodelProducerJwkKey)
          .values(producerJWKKeySQL);
      });
    },
    async getProducerJWKKeyByKid(
      kid: string
    ): Promise<WithMetadata<ProducerJWKKey>> {
      const queryResult = await db
        .select()
        .from(producerJwkKeyInReadmodelProducerJwkKey)
        .where(eq(producerJwkKeyInReadmodelProducerJwkKey.kid, kid));

      return aggregateProducerJWKKey(queryResult[0]);
    },
    async deleteProducerJWKKeyByKid(kid: string): Promise<void> {
      await db
        .delete(producerJwkKeyInReadmodelProducerJwkKey)
        .where(eq(producerJwkKeyInReadmodelProducerJwkKey.kid, kid));
    },
  };
}

export type ReadModelService = ReturnType<typeof readModelServiceBuilder>;
