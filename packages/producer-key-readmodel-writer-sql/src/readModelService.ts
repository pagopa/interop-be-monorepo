import {
  DrizzleReturnType,
  producerJwkKeyInReadmodelProducerJwkKey,
} from "pagopa-interop-readmodel-models";
import { and, eq, lte } from "drizzle-orm";
import { ProducerJWKKey, ProducerKeychainId } from "pagopa-interop-models";
import { ProducerJWKKeyReadModelService } from "pagopa-interop-readmodel";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function customReadModelServiceBuilder(
  db: DrizzleReturnType,
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

    async deleteProducerJWKKeyByProducerKeychainAndKid(
      producerKeychainId: ProducerKeychainId,
      kid: string,
      metadataVersion: number
    ): Promise<void> {
      await producerJWKKeyReadModelService.deleteProducerJWKKeyByProducerKeychainAndKid(
        producerKeychainId,
        kid,
        metadataVersion
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
export type CustomReadModelService = ReturnType<
  typeof customReadModelServiceBuilder
>;
