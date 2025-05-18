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
import { config } from "../config/config.js";
import { agreementRepo } from "../repository/agreement/agreement.repository.js";
import { agreementAttributeRepo } from "../repository/agreement/agreementAttribute.repository.js";
import { agreementConsumerDocumentRepo } from "../repository/agreement/agreementConsumerDocument.repository.js";
import { agreementContractRepo } from "../repository/agreement/agreementContract.repository.js";
import { agreementStampRepo } from "../repository/agreement/agreementStamp.repository.js";
import { mergeDeletingCascadeById } from "../utils/sqlQueryHelper.js";

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
        config.dbMessagesToInsertPerBatch
      )) {
        const batchItems = {
          agreements: batch.map((item) => item.agreementSQL),
          stamps: batch.flatMap((item) => item.stampsSQL),
          attrs: batch.flatMap((item) => item.attributesSQL),
          docs: batch.flatMap((item) => item.consumerDocumentsSQL),
          contracts: batch.flatMap((item) =>
            item.contractSQL ? [item.contractSQL] : []
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
        });

        genericLogger.info(
          `Staging data inserted for batch of ${batchItems.agreements.length} agreements`
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
        `Staging data merged into target tables for all batches`
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
      ctx: DBContext
    ) {
      for (const batch of batchMessages(
        docs,
        config.dbMessagesToInsertPerBatch
      )) {
        await ctx.conn.tx(async (t) => {
          await docRepository.insert(t, ctx.pgp, batch);
        });
      }
      genericLogger.info(
        `Staging data inserted for batch of ${docs.length} agreements contracts`
      );

      await ctx.conn.tx(async (t) => docRepository.merge(t));

      genericLogger.info(
        `Staging data merged into target tables for all batches`
      );
      await docRepository.clean();

      genericLogger.info(`Staging data cleaned`);
    },

    async upsertBatchAgreementContract(
      contracts: AgreementContractSQL[],
      ctx: DBContext
    ) {
      await ctx.conn.tx(async (t) => {
        for (const batch of batchMessages(
          contracts,
          config.dbMessagesToInsertPerBatch
        )) {
          await contractRepository.insert(t, ctx.pgp, batch);
        }
      });

      genericLogger.info(
        `Staging data inserted for batch of ${contracts.length} agreements contracts`
      );

      await ctx.conn.tx(async (t) => contractRepository.merge(t));

      genericLogger.info(
        `Staging data merged into target tables for all batches`
      );
      await contractRepository.clean();

      genericLogger.info(`Staging data cleaned`);
    },

    async deleteBatchAgreement(agreementIds: string[], ctx: DBContext) {
      await ctx.conn.tx(async (t) => {
        for (const batch of batchMessages(
          agreementIds,
          config.dbMessagesToInsertPerBatch
        )) {
          await agreementRepository.insertDeleting(t, ctx.pgp, batch);
          genericLogger.info(
            `Staging deletion inserted for agreementsId: ${batch.join(", ")}`
          );
        }
      });

      await ctx.conn.tx(async (t) => {
        await agreementRepository.mergeDeleting(t);
        await mergeDeletingCascadeById(
          t,
          "agreement_id",
          [
            AgreementDbTable.agreement_stamp,
            AgreementDbTable.agreement_attribute,
            AgreementDbTable.agreement_consumer_document,
            AgreementDbTable.agreement_contract,
          ],
          DeletingDbTable.agreement_deleting_table
        );
      });

      genericLogger.info(
        `Staging deletion merged into target tables for all agreementsIds`
      );

      await agreementRepository.cleanDeleting();

      genericLogger.info(`Staging data cleaned`);
    },

    async deleteBatchAgreementDocument(
      documentIds: string[],
      dbContext: DBContext
    ) {
      await dbContext.conn.tx(async (t) => {
        for (const batch of batchMessages(
          documentIds,
          config.dbMessagesToInsertPerBatch
        )) {
          await docRepository.insertDeleting(t, dbContext.pgp, batch);
          genericLogger.info(
            `Staging deletion inserted for agreement documentIds: ${batch.join(
              ", "
            )}`
          );
        }
      });

      await docRepository.mergeDeleting();

      genericLogger.info(
        `Staging deletion merged into target tables for all agreementsIds`
      );

      await docRepository.cleanDeleting();

      genericLogger.info(`Staging data cleaned`);
    },
  };
}

export type AgreementService = ReturnType<typeof agreementServiceBuilder>;
