import { ProducerKeychain, ProducerKeychainId } from "pagopa-interop-models";
import {
  checkMetadataVersion,
  splitProducerKeychainIntoObjectsSQL,
} from "pagopa-interop-readmodel";
import {
  DrizzleReturnType,
  producerKeychainInReadmodelProducerKeychain,
  producerKeychainUserInReadmodelProducerKeychain,
  producerKeychainEserviceInReadmodelProducerKeychain,
  producerKeychainKeyInReadmodelProducerKeychain,
} from "pagopa-interop-readmodel-models";
import { and, eq, lte } from "drizzle-orm";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function producerKeychainWriterServiceBuilder(db: DrizzleReturnType) {
  return {
    async upsertProducerKeychain(
      producerKeychain: ProducerKeychain,
      metadataVersion: number
    ): Promise<void> {
      await db.transaction(async (tx) => {
        const shouldUpsert = await checkMetadataVersion(
          tx,
          producerKeychainInReadmodelProducerKeychain,
          metadataVersion,
          producerKeychain.id
        );

        if (!shouldUpsert) {
          return;
        }

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
      });
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
export type ProducerKeychainWriterService = ReturnType<
  typeof producerKeychainWriterServiceBuilder
>;
