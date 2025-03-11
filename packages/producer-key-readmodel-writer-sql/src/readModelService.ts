import { producerJwkKeyInReadmodelProducerJwkKey } from "pagopa-interop-readmodel-models";
import { and, eq, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { ProducerJWKKey } from "pagopa-interop-models";
import { ProducerKeychainId } from "../../models/dist/brandedIds.js";
import { ProducerJWKKeyReadModelService } from "../../readmodel/dist/producerJWKKeyReadModelServiceSQL.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function customReadModelServiceBuilder(
  db: ReturnType<typeof drizzle>,
  producerJWKKeyReadModelService: ProducerJWKKeyReadModelService
) {
  return {
    async upsertProducerJWKKey(
      jwkKey: ProducerJWKKey,
      metadataVersion: number
    ): Promise<void> {
      await producerJWKKeyReadModelService.upsertProducerJWKKey(
        jwkKey,
        metadataVersion
      );
    },

    async deleteProducerJWKKeyByKid(
      producerKeychainId: ProducerKeychainId,
      kid: string,
      metadataVersion: number
    ): Promise<void> {
      await producerJWKKeyReadModelService.deleteProducerJWKKeyByKid(
        producerKeychainId,
        kid,
        metadataVersion
      );
    },

    async deleteProducerJWKKeyByProducerKeychainId(
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
export type CustomReadModelService = ReturnType<
  typeof customReadModelServiceBuilder
>;
