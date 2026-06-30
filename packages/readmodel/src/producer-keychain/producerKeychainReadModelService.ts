import { and, eq, ne } from "drizzle-orm";
import {
  EServiceId,
  ProducerKeychain,
  ProducerKeychainId,
  TenantId,
  WithMetadata,
} from "pagopa-interop-models";
import {
  DrizzleReturnType,
  producerKeychainEserviceInReadmodelProducerKeychain,
  producerKeychainInReadmodelProducerKeychain,
  producerKeychainKeyInReadmodelProducerKeychain,
  producerKeychainUserInReadmodelProducerKeychain,
} from "pagopa-interop-readmodel-models";
import {
  aggregateProducerKeychain,
  toProducerKeychainAggregator,
} from "./aggregators.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function producerKeychainReadModelServiceBuilder(db: DrizzleReturnType) {
  return {
    async getProducerKeychainById(
      producerKeychainId: ProducerKeychainId
    ): Promise<WithMetadata<ProducerKeychain> | undefined> {
      /*
        producer_keychain -> 1 producer_keychain_user
                          -> 2 producer_keychain_eservice
                          -> 3 producer_keychain_key
      */
      const queryResult = await db
        .select({
          producerKeychain: producerKeychainInReadmodelProducerKeychain,
          producerKeychainUser: producerKeychainUserInReadmodelProducerKeychain,
          producerKeychainEService:
            producerKeychainEserviceInReadmodelProducerKeychain,
          producerKeychainKey: producerKeychainKeyInReadmodelProducerKeychain,
        })
        .from(producerKeychainInReadmodelProducerKeychain)
        .where(
          eq(producerKeychainInReadmodelProducerKeychain.id, producerKeychainId)
        )
        .leftJoin(
          // 1
          producerKeychainUserInReadmodelProducerKeychain,
          eq(
            producerKeychainInReadmodelProducerKeychain.id,
            producerKeychainUserInReadmodelProducerKeychain.producerKeychainId
          )
        )
        .leftJoin(
          // 2
          producerKeychainEserviceInReadmodelProducerKeychain,
          eq(
            producerKeychainInReadmodelProducerKeychain.id,
            producerKeychainEserviceInReadmodelProducerKeychain.producerKeychainId
          )
        )
        .leftJoin(
          // 3
          producerKeychainKeyInReadmodelProducerKeychain,
          eq(
            producerKeychainInReadmodelProducerKeychain.id,
            producerKeychainKeyInReadmodelProducerKeychain.producerKeychainId
          )
        );

      if (queryResult.length === 0) {
        return undefined;
      }

      return aggregateProducerKeychain(
        toProducerKeychainAggregator(queryResult)
      );
    },
    async eserviceExistsInOtherProducerKeychains(
      eserviceId: EServiceId,
      producerId: TenantId,
      excludeKeychainId: ProducerKeychainId
    ): Promise<boolean> {
      const result = await db
        .select({
          id: producerKeychainInReadmodelProducerKeychain.id,
        })
        .from(producerKeychainEserviceInReadmodelProducerKeychain)
        .innerJoin(
          producerKeychainInReadmodelProducerKeychain,
          eq(
            producerKeychainEserviceInReadmodelProducerKeychain.producerKeychainId,
            producerKeychainInReadmodelProducerKeychain.id
          )
        )
        .where(
          and(
            eq(
              producerKeychainEserviceInReadmodelProducerKeychain.eserviceId,
              eserviceId
            ),
            eq(
              producerKeychainInReadmodelProducerKeychain.producerId,
              producerId
            ),
            ne(
              producerKeychainInReadmodelProducerKeychain.id,
              excludeKeychainId
            )
          )
        )
        .limit(1);
      return result.length > 0;
    },
  };
}
export type ProducerKeychainReadModelService = ReturnType<
  typeof producerKeychainReadModelServiceBuilder
>;
