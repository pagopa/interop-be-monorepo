import { and, eq, lte } from "drizzle-orm";
import {
  ProducerKeychain,
  ProducerKeychainId,
  WithMetadata,
} from "pagopa-interop-models";
import {
  DrizzleReturnType,
  producerKeychainEserviceInReadmodelProducerKeychain,
  producerKeychainInReadmodelProducerKeychain,
  producerKeychainKeyInReadmodelProducerKeychain,
  producerKeychainUserInReadmodelProducerKeychain,
} from "pagopa-interop-readmodel-models";
import { splitProducerKeychainIntoObjectsSQL } from "./authorization/producerKeychainSplitters.js";
import {
  aggregateProducerKeychain,
  toProducerKeychainAggregator,
} from "./authorization/producerKeychainAggregators.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function producerKeychainReadModelServiceBuilder(db: DrizzleReturnType) {
  return {
    async upsertProducerKeychain(
      producerKeychain: ProducerKeychain,
      metadataVersion: number
    ): Promise<void> {
      await db.transaction(async (tx) => {
        const existingMetadataVersion: number | undefined = (
          await tx
            .select({
              metadataVersion:
                producerKeychainInReadmodelProducerKeychain.metadataVersion,
            })
            .from(producerKeychainInReadmodelProducerKeychain)
            .where(
              eq(
                producerKeychainInReadmodelProducerKeychain.id,
                producerKeychain.id
              )
            )
        )[0]?.metadataVersion;

        if (
          !existingMetadataVersion ||
          existingMetadataVersion <= metadataVersion
        ) {
          await tx
            .delete(producerKeychainInReadmodelProducerKeychain)
            .where(
              eq(
                producerKeychainInReadmodelProducerKeychain.id,
                producerKeychain.id
              )
            );

          const { producerKeychainSQL, usersSQL, eservicesSQL, keysSQL } =
            splitProducerKeychainIntoObjectsSQL(
              producerKeychain,
              metadataVersion
            );

          await tx
            .insert(producerKeychainInReadmodelProducerKeychain)
            .values(producerKeychainSQL);

          for (const userSQL of usersSQL) {
            await tx
              .insert(producerKeychainUserInReadmodelProducerKeychain)
              .values(userSQL);
          }

          for (const eserviceSQL of eservicesSQL) {
            await tx
              .insert(producerKeychainEserviceInReadmodelProducerKeychain)
              .values(eserviceSQL);
          }

          for (const keySQL of keysSQL) {
            await tx
              .insert(producerKeychainKeyInReadmodelProducerKeychain)
              .values(keySQL);
          }
        }
      });
    },
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
    async deleteProducerKeychainById(
      producerKeychainId: ProducerKeychainId,
      metadataVersion: number
    ): Promise<void> {
      await db
        .delete(producerKeychainInReadmodelProducerKeychain)
        .where(
          and(
            eq(
              producerKeychainInReadmodelProducerKeychain.id,
              producerKeychainId
            ),
            lte(
              producerKeychainInReadmodelProducerKeychain.metadataVersion,
              metadataVersion
            )
          )
        );
    },
  };
}

export type ProducerKeychainReadModelService = ReturnType<
  typeof producerKeychainReadModelServiceBuilder
>;
