import { eq, and, SQL } from "drizzle-orm";
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
import { aggregateProducerJWKKey } from "./aggregators.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function producerJWKKeyReadModelServiceBuilder(db: DrizzleReturnType) {
  return {
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
  };
}
export type ProducerJWKKeyReadModelService = ReturnType<
  typeof producerJWKKeyReadModelServiceBuilder
>;
