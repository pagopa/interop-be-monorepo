import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import {
  ProducerKeychain,
  ProducerKeychainId,
  WithMetadata,
} from "pagopa-interop-models";
import {
  clientUserInReadmodelClient,
  producerKeychainEserviceInReadmodelProducerKeychain,
  producerKeychainInReadmodelProducerKeychain,
  producerKeychainKeyInReadmodelProducerKeychain,
  producerKeychainUserInReadmodelProducerKeychain,
} from "pagopa-interop-readmodel-models";
import { splitProducerKeychainIntoObjectsSQL } from "./authorization/producerKeychainSplitters.js";
import {
  aggregateProducerKeychain,
  aggregateProducerKeychainArray,
  toProducerKeychainAggregator,
  toProducerKeychainAggregatorArray,
} from "./authorization/producerKeychainAggregators.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function producerKeychainReadModelServiceBuilder(
  db: ReturnType<typeof drizzle>
) {
  return {
    async upsertProducerKeychain(
      producerKeychain: WithMetadata<ProducerKeychain>
    ): Promise<void> {
      const { producerKeychainSQL, usersSQL, eservicesSQL, keysSQL } =
        splitProducerKeychainIntoObjectsSQL(
          producerKeychain.data,
          producerKeychain.metadata.version
        );

      await db.transaction(async (tx) => {
        await tx
          .delete(producerKeychainInReadmodelProducerKeychain)
          .where(
            eq(
              producerKeychainInReadmodelProducerKeychain.id,
              producerKeychain.data.id
            )
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
        .from(producerKeychainEserviceInReadmodelProducerKeychain)
        .where(
          eq(producerKeychainInReadmodelProducerKeychain.id, producerKeychainId)
        )
        .leftJoin(
          // 1
          producerKeychainUserInReadmodelProducerKeychain,
          eq(
            producerKeychainInReadmodelProducerKeychain.id,
            clientUserInReadmodelClient.clientId
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
      producerKeychainId: ProducerKeychainId
    ): Promise<void> {
      await db
        .delete(producerKeychainEserviceInReadmodelProducerKeychain)
        .where(
          eq(
            producerKeychainEserviceInReadmodelProducerKeychain.producerKeychainId,
            producerKeychainId
          )
        );
    },
    async getAllProducerKeychainById(): Promise<
      Array<WithMetadata<ProducerKeychain>>
    > {
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
        .from(producerKeychainEserviceInReadmodelProducerKeychain)
        .leftJoin(
          // 1
          producerKeychainUserInReadmodelProducerKeychain,
          eq(
            producerKeychainInReadmodelProducerKeychain.id,
            clientUserInReadmodelClient.clientId
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
        return new Array<WithMetadata<ProducerKeychain>>();
      }

      return aggregateProducerKeychainArray(
        toProducerKeychainAggregatorArray(queryResult)
      );
    },
  };
}

export type ProducerKeychainReadModelService = ReturnType<
  typeof producerKeychainReadModelServiceBuilder
>;
