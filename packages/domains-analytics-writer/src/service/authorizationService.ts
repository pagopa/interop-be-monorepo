/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable functional/immutable-data */
/* eslint-disable sonarjs/cognitive-complexity */

import { genericLogger } from "pagopa-interop-commons";
import { DBContext } from "../db/db.js";
import { batchMessages } from "../utils/batchHelper.js";
import {
  cleaningTargetTables,
  mergeDeletingCascadeById,
} from "../utils/sqlQueryHelper.js";
import { config } from "../config/config.js";
import {
  ClientItemsSchema,
  ClientDeletingSchema,
} from "../model/authorization/client.js";
import {
  ClientUserSchema,
  ClientUserDeletingSchema,
} from "../model/authorization/clientUser.js";
import {
  ClientPurposeSchema,
  ClientPurposeDeletingSchema,
} from "../model/authorization/clientPurpose.js";
import {
  ClientKeySchema,
  ClientKeyDeletingSchema,
  ClientKeyUserMigrationSchema,
} from "../model/authorization/clientKey.js";
import {
  ClientDbTable,
  ProducerKeychainDbTable,
} from "../model/db/authorization.js";
import { DeletingDbTable } from "../model/db/deleting.js";
import { clientRepository } from "../repository/client/client.repository.js";
import { clientKeyRepository } from "../repository/client/clientKey.repository.js";
import { clientPurposeRepository } from "../repository/client/clientPurpose.repository.js";
import { clientUserRepository } from "../repository/client/clientUser.repository.js";
import {
  ProducerKeychainDeletingSchema,
  ProducerKeychainItemsSchema,
} from "../model/authorization/producerKeychain.js";
import { producerKeychainRepository } from "../repository/producerKeychain/producerKeychain.repository.js";
import { producerKeychainEServiceRepository } from "../repository/producerKeychain/producerKeychainEService.repository.js";
import { producerKeychainKeyRepository } from "../repository/producerKeychain/producerKeychainKey.js";
import { producerKeychainUserRepository } from "../repository/producerKeychain/producerKeychainUser.repository.js";

export function authorizationServiceBuilder(db: DBContext) {
  const clientRepo = clientRepository(db.conn);
  const clientUserRepo = clientUserRepository(db.conn);
  const clientPurposeRepo = clientPurposeRepository(db.conn);
  const clientKeyRepo = clientKeyRepository(db.conn);
  const producerKeychainRepo = producerKeychainRepository(db.conn);
  const producerKeychainUserRepo = producerKeychainUserRepository(db.conn);
  const producerKeychainEServiceRepo = producerKeychainEServiceRepository(
    db.conn
  );
  const producerKeychainKeyRepo = producerKeychainKeyRepository(db.conn);

  return {
    async upsertClientBatch(dbContext: DBContext, items: ClientItemsSchema[]) {
      await dbContext.conn.tx(async (t) => {
        for (const batch of batchMessages(
          items,
          config.dbMessagesToInsertPerBatch
        )) {
          const batchItems = {
            clientSQL: batch.map((i) => i.clientSQL),
            usersSQL: batch.flatMap((i) => i.usersSQL),
            purposesSQL: batch.flatMap((i) => i.purposesSQL),
            keysSQL: batch.flatMap((i) => i.keysSQL),
          };

          if (batchItems.clientSQL.length) {
            await clientRepo.insert(t, dbContext.pgp, batchItems.clientSQL);
          }
          if (batchItems.usersSQL.length) {
            await clientUserRepo.insert(t, dbContext.pgp, batchItems.usersSQL);
          }
          if (batchItems.purposesSQL.length) {
            await clientPurposeRepo.insert(
              t,
              dbContext.pgp,
              batchItems.purposesSQL
            );
          }
          if (batchItems.keysSQL.length) {
            await clientKeyRepo.insert(t, dbContext.pgp, batchItems.keysSQL);
          }

          genericLogger.info(
            `Staging data inserted for Client batch: ${batch
              .map((i) => i.clientSQL.id)
              .join(", ")}`
          );
        }

        await clientRepo.merge(t);
        await clientUserRepo.merge(t);
        await clientPurposeRepo.merge(t);
        await clientKeyRepo.merge(t);
      });

      await dbContext.conn.tx(async (t) => {
        await cleaningTargetTables(
          t,
          "clientId",
          [
            ClientDbTable.client_user,
            ClientDbTable.client_purpose,
            ClientDbTable.client_key,
          ],
          ClientDbTable.client
        );
      });

      genericLogger.info(
        `Staging data merged into target tables for all Client batches`
      );

      await clientRepo.clean();
      await clientUserRepo.clean();
      await clientPurposeRepo.clean();
      await clientKeyRepo.clean();

      genericLogger.info(`Staging data cleaned for Client`);
    },

    async deleteClientBatch(
      dbContext: DBContext,
      items: ClientDeletingSchema[]
    ) {
      await dbContext.conn.tx(async (t) => {
        for (const batch of batchMessages(
          items,
          config.dbMessagesToInsertPerBatch
        )) {
          await clientRepo.insertDeleting(t, dbContext.pgp, batch);
          genericLogger.info(
            `Staging deletion inserted for Client ids: ${batch
              .map((i) => i.id)
              .join(", ")}`
          );
        }

        await clientRepo.mergeDeleting(t);
        await mergeDeletingCascadeById(
          t,
          "clientId",
          [
            ClientDbTable.client_user,
            ClientDbTable.client_purpose,
            ClientDbTable.client_key,
          ],
          DeletingDbTable.client_deleting_table
        );
      });

      genericLogger.info(
        `Staging deletion merged into target tables for Client`
      );

      await clientRepo.cleanDeleting();

      genericLogger.info(`Client deleting table cleaned`);
    },

    async upsertClientUserBatch(
      dbContext: DBContext,
      items: ClientUserSchema[]
    ) {
      await dbContext.conn.tx(async (t) => {
        for (const batch of batchMessages(
          items,
          config.dbMessagesToInsertPerBatch
        )) {
          await clientUserRepo.insert(t, dbContext.pgp, batch);
          genericLogger.info(
            `Staging data inserted for ClientUser batch: ${batch
              .map((i) => `${i.clientId}/${i.userId}`)
              .join(", ")}`
          );
        }

        await clientUserRepo.merge(t);
      });

      genericLogger.info(
        `Staging data merged into target tables for ClientUser`
      );

      await clientUserRepo.clean();

      genericLogger.info(`Staging data cleaned for ClientUser`);
    },

    async removeClientUserBatch(
      dbContext: DBContext,
      items: ClientUserDeletingSchema[]
    ) {
      await dbContext.conn.tx(async (t) => {
        for (const batch of batchMessages(
          items,
          config.dbMessagesToInsertPerBatch
        )) {
          await clientUserRepo.insertDeleting(t, dbContext.pgp, batch);
          genericLogger.info(
            `Staging deletion inserted for ClientUser: ${batch
              .map((i) => `${i.clientId}/${i.userId}`)
              .join(", ")}`
          );
        }

        await clientUserRepo.mergeDeleting(t);
      });

      genericLogger.info(
        `Staging deletion merged into target tables for ClientUser`
      );

      await clientUserRepo.cleanDeleting();
      genericLogger.info(`ClientUser deleting table cleaned`);
    },

    async upsertClientPurposeBatch(
      dbContext: DBContext,
      items: ClientPurposeSchema[]
    ) {
      await dbContext.conn.tx(async (t) => {
        for (const batch of batchMessages(
          items,
          config.dbMessagesToInsertPerBatch
        )) {
          await clientPurposeRepo.insert(t, dbContext.pgp, batch);
          genericLogger.info(
            `Staging data inserted for ClientPurpose batch: ${batch
              .map((i) => `${i.clientId}/${i.purposeId}`)
              .join(", ")}`
          );
        }

        await clientPurposeRepo.merge(t);
      });

      genericLogger.info(
        `Staging data merged into target tables for ClientPurpose`
      );

      await clientPurposeRepo.clean();

      genericLogger.info(`Staging data cleaned for ClientPurpose`);
    },

    async removeClientPurposeBatch(
      dbContext: DBContext,
      items: ClientPurposeDeletingSchema[]
    ) {
      await dbContext.conn.tx(async (t) => {
        for (const batch of batchMessages(
          items,
          config.dbMessagesToInsertPerBatch
        )) {
          await clientPurposeRepo.insertDeleting(t, dbContext.pgp, batch);
          genericLogger.info(
            `Staging deletion inserted for ClientPurpose: ${batch
              .map((i) => `${i.clientId}/${i.purposeId}`)
              .join(", ")}`
          );
        }

        await clientPurposeRepo.mergeDeleting(t);
      });

      genericLogger.info(
        `Staging deletion merged into target tables for ClientPurpose`
      );

      await clientPurposeRepo.cleanDeleting();

      genericLogger.info(`ClientPurpose deleting table cleaned`);
    },

    async upsertClientKeyBatch(dbContext: DBContext, items: ClientKeySchema[]) {
      await dbContext.conn.tx(async (t) => {
        for (const batch of batchMessages(
          items,
          config.dbMessagesToInsertPerBatch
        )) {
          await clientKeyRepo.insert(t, dbContext.pgp, batch);

          genericLogger.info(
            `Staging data inserted for ClientKey batch: ${batch
              .map((i) => `${i.clientId}/${i.kid}`)
              .join(", ")}`
          );
        }
        await clientKeyRepo.merge(t);
      });

      genericLogger.info(
        `Staging data merged into target tables for ClientKey`
      );

      await clientKeyRepo.clean();

      genericLogger.info(`Staging data cleaned for ClientKey`);
    },

    async deleteClientKeyBatch(
      dbContext: DBContext,
      items: ClientKeyDeletingSchema[]
    ) {
      await dbContext.conn.tx(async (t) => {
        for (const batch of batchMessages(
          items,
          config.dbMessagesToInsertPerBatch
        )) {
          await clientKeyRepo.insertDeleting(t, dbContext.pgp, batch);
          genericLogger.info(
            `Staging deletion inserted for ClientKey: ${batch
              .map((i) => `${i.clientId}/${i.kid}`)
              .join(", ")}`
          );
        }
        await clientKeyRepo.mergeDeleting(t);
      });

      genericLogger.info(
        `Staging deletion merged into target tables for ClientKey`
      );

      await clientKeyRepo.cleanDeleting();

      genericLogger.info(`ClientKey deleting table cleaned`);
    },

    async upsertMigrateKeyUserRelationshipBatch(
      dbContext: DBContext,
      items: ClientKeyUserMigrationSchema[]
    ): Promise<void> {
      await dbContext.conn.tx(async (t) => {
        for (const batch of batchMessages(
          items,
          config.dbMessagesToInsertPerBatch
        )) {
          await clientKeyRepo.insertKeyUserMigration(t, dbContext.pgp, batch);
          genericLogger.info(
            `Staging data inserted for ClientKeyUserMigration batch: ${batch
              .map((item) => `${item.clientId}/${item.kid}`)
              .join(", ")}`
          );
        }

        await clientKeyRepo.mergeKeyUserMigration(t);
      });

      genericLogger.info(
        `Staging data merged into target tables for ClientKeyUserMigration`
      );

      await clientKeyRepo.clean();

      genericLogger.info(`Staging table cleaned for ClientKeyUserMigration`);
    },

    async upsertProducerKeychainBatch(
      dbContext: DBContext,
      items: ProducerKeychainItemsSchema[]
    ) {
      await dbContext.conn.tx(async (t) => {
        for (const batch of batchMessages(
          items,
          config.dbMessagesToInsertPerBatch
        )) {
          const batchItems = {
            producerKeychainSQL: batch.map((i) => i.producerKeychainSQL),
            usersSQL: batch.flatMap((i) => i.usersSQL),
            eservicesSQL: batch.flatMap((i) => i.eservicesSQL),
            keysSQL: batch.flatMap((i) => i.keysSQL),
          };

          if (batchItems.producerKeychainSQL.length) {
            await producerKeychainRepo.insert(
              t,
              dbContext.pgp,
              batchItems.producerKeychainSQL
            );
          }
          if (batchItems.usersSQL.length) {
            await producerKeychainUserRepo.insert(
              t,
              dbContext.pgp,
              batchItems.usersSQL
            );
          }
          if (batchItems.eservicesSQL.length) {
            await producerKeychainEServiceRepo.insert(
              t,
              dbContext.pgp,
              batchItems.eservicesSQL
            );
          }
          if (batchItems.keysSQL.length) {
            await producerKeychainKeyRepo.insert(
              t,
              dbContext.pgp,
              batchItems.keysSQL
            );
          }

          genericLogger.info(
            `Staging data inserted for ProducerKeychain batch: ${batch
              .map((i) => i.producerKeychainSQL.id)
              .join(", ")}`
          );
        }

        await producerKeychainRepo.merge(t);
        await producerKeychainUserRepo.merge(t);
        await producerKeychainEServiceRepo.merge(t);
        await producerKeychainKeyRepo.merge(t);
      });

      await dbContext.conn.tx(async (t) => {
        await cleaningTargetTables(
          t,
          "producerKeychainId",
          [
            ProducerKeychainDbTable.producer_keychain_user,
            ProducerKeychainDbTable.producer_keychain_eservice,
            ProducerKeychainDbTable.producer_keychain_key,
          ],
          ProducerKeychainDbTable.producer_keychain
        );
      });

      genericLogger.info(
        `Staging data merged into target tables for ProducerKeychain`
      );

      await producerKeychainRepo.clean();
      await producerKeychainUserRepo.clean();
      await producerKeychainEServiceRepo.clean();
      await producerKeychainKeyRepo.clean();

      genericLogger.info(`Staging data cleaned for ProducerKeychain`);
    },

    async deleteProducerKeychainBatch(
      dbContext: DBContext,
      items: ProducerKeychainDeletingSchema[]
    ) {
      await dbContext.conn.tx(async (t) => {
        for (const batch of batchMessages(
          items,
          config.dbMessagesToInsertPerBatch
        )) {
          await producerKeychainRepo.insertDeleting(t, dbContext.pgp, batch);
          genericLogger.info(
            `Staging deletion inserted for ProducerKeychain ids: ${batch
              .map((i) => i.id)
              .join(", ")}`
          );
        }

        await producerKeychainRepo.mergeDeleting(t);
        await mergeDeletingCascadeById(
          t,
          "producerKeychainId",
          [
            ProducerKeychainDbTable.producer_keychain_user,
            ProducerKeychainDbTable.producer_keychain_eservice,
            ProducerKeychainDbTable.producer_keychain_key,
          ],
          DeletingDbTable.producer_keychain_deleting_table
        );
      });

      genericLogger.info(`Staging deletion merged for ProducerKeychain`);

      await producerKeychainRepo.cleanDeleting();

      genericLogger.info(`ProducerKeychain deleting table cleaned`);
    },
  };
}
