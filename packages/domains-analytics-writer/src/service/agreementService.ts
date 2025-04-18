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
        config.dbMessagesToInsertPerBatch
      )) {
        const staged = {
          agreements: batch.map((i) => i.agreementSQL),
          stamps: batch.flatMap((i) => i.stampsSQL),
          attrs: batch.flatMap((i) => i.attributesSQL),
          docs: batch.flatMap((i) => i.consumerDocumentsSQL),
          contracts: batch.flatMap((i) =>
            i.contractSQL ? [i.contractSQL] : []
          ),
        };

        await ctx.conn.tx(async (t) => {
          if (staged.agreements.length) {
            await agreementRepository.insert(t, ctx.pgp, staged.agreements);
          }
          if (staged.stamps.length) {
            await stampRepository.insert(t, ctx.pgp, staged.stamps);
          }
          if (staged.attrs.length) {
            await attributeRepository.insert(t, ctx.pgp, staged.attrs);
          }
          if (staged.docs.length) {
            await docRepository.insert(t, ctx.pgp, staged.docs);
          }
          if (staged.contracts.length) {
            await contractRepository.insert(t, ctx.pgp, staged.contracts);
          }
        });

        genericLogger.info(
          `Staged ${staged.agreements.length} agreements (+related objects)`
        );
      }

      /* merge & clean */
      await ctx.conn.tx(async (t) => {
        await agreementRepository.merge(t);
        await stampRepository.merge(t);
        await attributeRepository.merge(t);
        await docRepository.merge(t);
        await contractRepository.merge(t);
      });
      genericLogger.info("Agreement batches merged");

      await Promise.all([
        agreementRepository.cleanStage(),
        stampRepository.cleanStage(),
        attributeRepository.cleanStage(),
        docRepository.cleanStage(),
        contractRepository.cleanStage(),
      ]);
      genericLogger.info("Agreement staging tables truncated");
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
      await ctx.conn.tx(async (t) => docRepository.merge(t));
      await docRepository.cleanStage();
    },

    async upsertBatchAgreementContract(
      contracts: AgreementContractSQL[],
      ctx: DBContext
    ) {
      for (const batch of batchMessages(
        contracts,
        config.dbMessagesToInsertPerBatch
      )) {
        await ctx.conn.tx(async (t) => {
          await contractRepository.insert(t, ctx.pgp, batch);
        });
      }
      await ctx.conn.tx(async (t) => contractRepository.merge(t));
      await contractRepository.cleanStage();
    },

    async deleteBatchAgreement(agreementIds: string[], ctx: DBContext) {
      for (const batch of batchMessages(
        agreementIds,
        config.dbMessagesToInsertPerBatch
      )) {
        await ctx.conn.tx(async (t) => {
          for (const id of batch) {
            await agreementRepository.deleteStaged(t, ctx.pgp, id);
          }
        });
        genericLogger.info(`Staged delete for agreements: ${batch.join(",")}`);
      }

      await ctx.conn.tx(async (t) => {
        await agreementRepository.mergeDeletes(t);
        await mergeDeletingById(
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
      genericLogger.info("Agreement deletions merged");

      await agreementRepository.cleanDeleteStage();
    },
    async deleteBatchAgreementDocument(documentIds: string[], ctx: DBContext) {
      for (const batch of batchMessages(
        documentIds,
        config.dbMessagesToInsertPerBatch
      )) {
        await ctx.conn.tx(async (t) => {
          for (const id of batch) {
            await docRepository.delete(t, id);
          }
        });
      }
      await ctx.conn.tx(async (t) =>
        mergeDeletingById(
          t,
          "id",
          [AgreementDbTable.agreement_consumer_document],
          DeletingDbTable.agreement_deleting_table
        )
      );
    },
  };
}

export type AgreementService = ReturnType<typeof agreementServiceBuilder>;
