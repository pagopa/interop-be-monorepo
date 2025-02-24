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
  aggregateProducerKeychainSQL,
  fromJoinToAggregator,
} from "./authorization/producerKeychainAggregators.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilder(db: ReturnType<typeof drizzle>) {
  return {
    async addProducerKeychain(
      producerKeychain: WithMetadata<ProducerKeychain>
    ): Promise<void> {
      const {
        producerKeychainSQL,
        producerKeychainUsersSQL,
        producerKeychainEServicesSQL,
        producerKeychainKeysSQL,
      } = splitProducerKeychainIntoObjectsSQL(
        producerKeychain.data,
        producerKeychain.metadata.version
      );

      await db.transaction(async (tx) => {
        await tx
          .insert(producerKeychainInReadmodelProducerKeychain)
          .values(producerKeychainSQL);

        for (const user of producerKeychainUsersSQL) {
          await tx
            .insert(producerKeychainUserInReadmodelProducerKeychain)
            .values(user);
        }

        for (const purpose of producerKeychainEServicesSQL) {
          await tx
            .insert(producerKeychainEserviceInReadmodelProducerKeychain)
            .values(purpose);
        }

        for (const key of producerKeychainKeysSQL) {
          await tx
            .insert(producerKeychainKeyInReadmodelProducerKeychain)
            .values(key);
        }
      });
    },
    async getProducerKeychinById(
      producerKeychainId: ProducerKeychainId
    ): Promise<WithMetadata<ProducerKeychain>> {
      /*
        producer_keychain -> 1 producer_keychain_user
                          -> 2 producer_keychaint_eservice
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

      const aggregatorInput = fromJoinToAggregator(queryResult);
      return aggregateProducerKeychainSQL(aggregatorInput);
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
  };
}

export type ReadModelService = ReturnType<typeof readModelServiceBuilder>;
