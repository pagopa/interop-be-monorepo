/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable functional/immutable-data */
import { genericLogger } from "pagopa-interop-commons";
import {
  AgreementConsumerDocumentSQL,
  AgreementContractSQL,
  AgreementItemsSQL,
} from "pagopa-interop-readmodel-models";
import { DBContext } from "../db/db.js";

import { AgreementDbTable, DeletingDbTable } from "../model/db.js";
import { batchMessages } from "../utils/batchHelper.js";
import { mergeDeletingById } from "../utils/sqlQueryHelper.js";
import { config } from "../config/config.js";
import { agreementRepo } from "../repository/agreement/agreement.repository.js";
import { agreementAttributeRepo } from "../repository/agreement/agreementAttribute.repository.js";
import { agreementConsumerDocumentRepo } from "../repository/agreement/agreementConsumerDocument.repository.js";
import { agreementContractRepo } from "../repository/agreement/agreementContract.repository.js";
import { agreementStampRepo } from "../repository/agreement/agreementStamp.repository.js";

export function agreementServiceBuilder(db: DBContext) {
  const agreementRepository = agreementRepo(db.conn);
  const stampRepository = agreementStampRepo(db.conn);
  const attributeRepository = agreementAttributeRepo(db.conn);
  const docRepository = agreementConsumerDocumentRepo(db.conn);
  const contractRepository = agreementContractRepo(db.conn);
  return {
    async upsertBatchAgreement(items: AgreementItemsSQL[], ctx: DBContext) {
      for (const batch of batchMessages(
        items,
        config.dbMessagesToInsertPerBatch,
      )) {
        const batchItems = {
          agreements: batch.map((i) => i.agreementSQL),
          stamps: batch.flatMap((i) => i.stampsSQL),
          attrs: batch.flatMap((i) => i.attributesSQL),
          docs: batch.flatMap((i) => i.consumerDocumentsSQL),
          contracts: batch.flatMap((i) =>
            i.contractSQL ? [i.contractSQL] : [],
          ),
        };

        await ctx.conn.tx(async (t) => {
          if (batchItems.agreements.length) {
            await agreementRepository.insert(t, ctx.pgp, batchItems.agreements);
          }
          if (batchItems.stamps.length) {
            await stampRepository.insert(t, ctx.pgp, batchItems.stamps);
          }
          if (batchItems.attrs.length) {
            await attributeRepository.insert(t, ctx.pgp, batchItems.attrs);
          }
          if (batchItems.docs.length) {
            await docRepository.insert(t, ctx.pgp, batchItems.docs);
          }
          if (batchItems.contracts.length) {
            await contractRepository.insert(t, ctx.pgp, batchItems.contracts);
          }
          if (batchItems.stamps.length) {
            await stampRepository.insert(t, ctx.pgp, batchItems.stamps);
          }
        });

        genericLogger.info(
          `Staging data inserted for batch of ${batchItems.agreements.length} agreements`,
        );
      }

      await ctx.conn.tx(async (t) => {
        await agreementRepository.merge(t);
        await stampRepository.merge(t);
        await attributeRepository.merge(t);
        await docRepository.merge(t);
        await contractRepository.merge(t);
        await stampRepository.merge(t);
      });

      genericLogger.info(
        `Staging data merged into target tables for all batches`,
      );

      await agreementRepository.clean();
      await stampRepository.clean();
      await attributeRepository.clean();
      await docRepository.clean();
      await contractRepository.clean();
      await stampRepository.clean();

      genericLogger.info(`Staging data cleaned`);
    },

    async upsertBatchAgreementDocument(
      docs: AgreementConsumerDocumentSQL[],
      ctx: DBContext,
    ) {
      for (const batch of batchMessages(
        docs,
        config.dbMessagesToInsertPerBatch,
      )) {
        await ctx.conn.tx(async (t) => {
          await docRepository.insert(t, ctx.pgp, batch);
        });
      }
      await ctx.conn.tx(async (t) => docRepository.merge(t));
      await docRepository.clean();
    },

    async upsertBatchAgreementContract(
      contracts: AgreementContractSQL[],
      ctx: DBContext,
    ) {
      for (const batch of batchMessages(
        contracts,
        config.dbMessagesToInsertPerBatch,
      )) {
        await ctx.conn.tx(async (t) => {
          await contractRepository.insert(t, ctx.pgp, batch);
        });
      }

      genericLogger.info(
        `Staging data inserted for batch of ${contracts.length} agreements contracts`,
      );

      await ctx.conn.tx(async (t) => contractRepository.merge(t));

      genericLogger.info(
        `Staging data merged into target tables for all batches`,
      );
      await contractRepository.clean();

      genericLogger.info(`Staging data cleaned`);
    },

    async deleteBatchAgreement(agreementIds: string[], ctx: DBContext) {
      for (const batch of batchMessages(
        agreementIds,
        config.dbMessagesToInsertPerBatch,
      )) {
        await ctx.conn.tx(async (t) => {
          for (const id of batch) {
            await agreementRepository.insertDeletingByAgreeementId(
              t,
              ctx.pgp,
              id,
            );
          }
        });
        genericLogger.info(
          `Staging deletion inserted for agreementsId: ${batch.join(", ")}`,
        );
      }

      await ctx.conn.tx(async (t) => {
        await agreementRepository.mergeDeleting(t);
        await mergeDeletingById(
          t,
          "agreement_id",
          [
            AgreementDbTable.agreement_stamp,
            AgreementDbTable.agreement_attribute,
            AgreementDbTable.agreement_consumer_document,
            AgreementDbTable.agreement_contract,
          ],
          DeletingDbTable.agreement_deleting_table,
        );
      });

      genericLogger.info(
        `Staging deletion merged into target tables for all agreementsIds`,
      );

      await agreementRepository.cleanDeleting();

      genericLogger.info(`Staging data cleaned`);
    },
    async deleteBatchAgreementDocument(
      documentIds: string[],
      dbContext: DBContext,
    ) {
      for (const batch of batchMessages(
        documentIds,
        config.dbMessagesToInsertPerBatch,
      )) {
        await dbContext.conn.tx(async (t) => {
          for (const id of batch) {
            await docRepository.insertDeletingByAgreementId(
              t,
              dbContext.pgp,
              id,
            );
          }
        });
        genericLogger.info(
          `Staging deletion inserted for agreement documentIds: ${batch.join(
            ", ",
          )}`,
        );
      }
      await docRepository.mergeDeleting();
      genericLogger.info(
        `Staging deletion merged into target tables for all agreementsIds`,
      );
      await docRepository.cleanDeleting();

      genericLogger.info(`Staging data cleaned`);
    },
  };
}

export type AgreementService = ReturnType<typeof agreementServiceBuilder>;
