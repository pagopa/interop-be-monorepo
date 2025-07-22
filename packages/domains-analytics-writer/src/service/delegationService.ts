/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { genericLogger } from "pagopa-interop-commons";
import { DBContext } from "../db/db.js";
import { batchMessages } from "../utils/batchHelper.js";
import { config } from "../config/config.js";
import { DelegationItemsSchema } from "../model/delegation/delegation.js";
import { delegationRepository } from "../repository/delegation/delegation.repository.js";
import { delegationStampRepository } from "../repository/delegation/delegationStamp.repository.js";
import { delegationContractDocumentRepository } from "../repository/delegation/delegationContractDocument.repository.js";
import { cleaningTargetTables } from "../utils/sqlQueryHelper.js";
import { DelegationDbTable } from "../model/db/delegation.js";

export function delegationServiceBuilder(dbContext: DBContext) {
  const delegationRepo = delegationRepository(dbContext.conn);
  const stampRepo = delegationStampRepository(dbContext.conn);
  const contractDocumentRepo = delegationContractDocumentRepository(
    dbContext.conn
  );

  return {
    async upsertBatchDelegation(
      dbContext: DBContext,
      items: DelegationItemsSchema[]
    ): Promise<void> {
      await dbContext.conn.tx(async (t) => {
        for (const batch of batchMessages(
          items,
          config.dbMessagesToInsertPerBatch
        )) {
          const batchItems = {
            delegationSQL: batch.map((item) => item.delegationSQL),
            stampsSQL: batch.flatMap((item) => item.stampsSQL),
            contractDocumentsSQL: batch.flatMap(
              (item) => item.contractDocumentsSQL
            ),
          };

          if (batchItems.delegationSQL.length) {
            await delegationRepo.insert(
              t,
              dbContext.pgp,
              batchItems.delegationSQL
            );
          }
          if (batchItems.stampsSQL.length) {
            await stampRepo.insert(t, dbContext.pgp, batchItems.stampsSQL);
          }
          if (batchItems.contractDocumentsSQL.length) {
            await contractDocumentRepo.insert(
              t,
              dbContext.pgp,
              batchItems.contractDocumentsSQL
            );
          }

          genericLogger.info(
            `Staging delegation batch inserted: ${batch
              .map((item) => item.delegationSQL.id)
              .join(", ")}`
          );
        }

        await delegationRepo.merge(t);
        await stampRepo.merge(t);
        await contractDocumentRepo.merge(t);
      });

      await dbContext.conn.tx(async (t) => {
        await cleaningTargetTables(
          t,
          "delegationId",
          [
            DelegationDbTable.delegation_contract_document,
            DelegationDbTable.delegation_stamp,
          ],
          DelegationDbTable.delegation
        );
      });

      genericLogger.info(
        `Staging data merged into target delegation tables for all batches`
      );

      await delegationRepo.clean();
      await stampRepo.clean();
      await contractDocumentRepo.clean();

      genericLogger.info(`Staging data cleaned for delegation tables`);
    },
  };
}

export type DelegationService = ReturnType<typeof delegationServiceBuilder>;
