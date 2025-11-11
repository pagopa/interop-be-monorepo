/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable functional/immutable-data */
/* eslint-disable sonarjs/cognitive-complexity */
import { genericLogger } from "pagopa-interop-commons";
import { DBContext } from "../db/db.js";
import { AgreementDbTable, DeletingDbTable } from "../model/db/index.js";
import { batchMessages } from "../utils/batchHelper.js";
import { config } from "../config/config.js";
import { agreementRepo } from "../repository/agreement/agreement.repository.js";
import { agreementAttributeRepo } from "../repository/agreement/agreementAttribute.repository.js";
import { agreementConsumerDocumentRepo } from "../repository/agreement/agreementConsumerDocument.repository.js";
import { agreementContractRepo } from "../repository/agreement/agreementContract.repository.js";
import { agreementStampRepo } from "../repository/agreement/agreementStamp.repository.js";
import {
  cleaningTargetTables,
  mergeDeletingCascadeById,
} from "../utils/sqlQueryHelper.js";
import {
  AgreementDeletingSchema,
  AgreementItemsSchema,
} from "../model/agreement/agreement.js";
import {
  AgreementConsumerDocumentDeletingSchema,
  AgreementConsumerDocumentSchema,
} from "../model/agreement/agreementConsumerDocument.js";
import { AgreementContractSchema } from "../model/agreement/agreementContract.js";
import { agreementSignedContractRepo } from "../repository/agreement/agreementSignedContract.repository.js";

export function agreementServiceBuilder(db: DBContext) {
  const agreementRepository = agreementRepo(db.conn);
  const stampRepository = agreementStampRepo(db.conn);
  const attributeRepository = agreementAttributeRepo(db.conn);
  const docRepository = agreementConsumerDocumentRepo(db.conn);
  const contractRepository = agreementContractRepo(db.conn);
  const signedContractRepository = agreementSignedContractRepo(db.conn);

  return {
    async upsertBatchAgreement(
      dbContext: DBContext,
      items: AgreementItemsSchema[]
    ) {
      await dbContext.conn.tx(async (t) => {
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
            signedContracts: batch.flatMap((item) =>
              item.signedContractSQL ? [item.signedContractSQL] : []
            ),
          };

          if (batchItems.agreements.length) {
            await agreementRepository.insert(
              t,
              dbContext.pgp,
              batchItems.agreements
            );
          }
          if (batchItems.stamps.length) {
            await stampRepository.insert(t, dbContext.pgp, batchItems.stamps);
          }
          if (batchItems.attrs.length) {
            await attributeRepository.insert(
              t,
              dbContext.pgp,
              batchItems.attrs
            );
          }
          if (batchItems.docs.length) {
            await docRepository.insert(t, dbContext.pgp, batchItems.docs);
          }
          if (batchItems.contracts.length) {
            await contractRepository.insert(
              t,
              dbContext.pgp,
              batchItems.contracts
            );
          }
          if (batchItems.signedContracts.length) {
            await signedContractRepository.insert(
              t,
              dbContext.pgp,
              batchItems.signedContracts
            );
          }

          genericLogger.info(
            `Staging data inserted for agreement batch: ${batchItems.agreements
              .map((a) => a.id)
              .join(", ")}`
          );
        }

        await agreementRepository.merge(t);
        await stampRepository.merge(t);
        await attributeRepository.merge(t);
        await docRepository.merge(t);
        await contractRepository.merge(t);
        await signedContractRepository.merge(t);
      });

      await dbContext.conn.tx(async (t) => {
        await cleaningTargetTables(
          t,
          "agreementId",
          [
            AgreementDbTable.agreement_stamp,
            AgreementDbTable.agreement_attribute,
            AgreementDbTable.agreement_consumer_document,
            AgreementDbTable.agreement_contract,
            AgreementDbTable.agreement_signed_contract,
          ],
          AgreementDbTable.agreement
        );
      });

      genericLogger.info(
        "Staging data merged into target tables for all agreement batches"
      );

      await agreementRepository.clean();
      await stampRepository.clean();
      await attributeRepository.clean();
      await docRepository.clean();
      await contractRepository.clean();
      await signedContractRepository.clean();

      genericLogger.info("Staging data cleaned for agreement");
    },

    async upsertBatchAgreementDocument(
      dbContext: DBContext,
      docs: AgreementConsumerDocumentSchema[]
    ) {
      await dbContext.conn.tx(async (t) => {
        for (const batch of batchMessages(
          docs,
          config.dbMessagesToInsertPerBatch
        )) {
          await docRepository.insert(t, dbContext.pgp, batch);
          genericLogger.info(
            `Staging data inserted for agreement document batch: ${batch
              .map((doc) => doc.id)
              .join(", ")}`
          );
        }

        await docRepository.merge(t);
      });

      genericLogger.info(
        "Staging data merged into target tables for agreement documents"
      );

      await docRepository.clean();

      genericLogger.info("Staging data cleaned for agreement documents");
    },

    async upsertBatchAgreementContract(
      dbContext: DBContext,
      contracts: AgreementContractSchema[]
    ) {
      await dbContext.conn.tx(async (t) => {
        for (const batch of batchMessages(
          contracts,
          config.dbMessagesToInsertPerBatch
        )) {
          await contractRepository.insert(t, dbContext.pgp, batch);

          genericLogger.info(
            `Staging data inserted for agreement contract batch: ${batch
              .map((c) => c.id)
              .join(", ")}`
          );
        }

        await contractRepository.merge(t);
      });

      genericLogger.info(
        "Staging data merged into target tables for agreement contracts"
      );

      await contractRepository.clean();

      genericLogger.info("Staging data cleaned for agreement contracts");
    },

    async deleteBatchAgreement(
      dbContext: DBContext,
      records: AgreementDeletingSchema[]
    ) {
      await dbContext.conn.tx(async (t) => {
        for (const batch of batchMessages(
          records,
          config.dbMessagesToInsertPerBatch
        )) {
          await agreementRepository.insertDeleting(t, dbContext.pgp, batch);
          genericLogger.info(
            `Staging deletion inserted for agreement ids: ${batch
              .map((r) => r.id)
              .join(", ")}`
          );
        }

        await agreementRepository.mergeDeleting(t);
        await mergeDeletingCascadeById(
          t,
          "agreementId",
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
        "Staging deletion merged into target tables for agreements"
      );

      await agreementRepository.cleanDeleting();

      genericLogger.info("Staging deleting data cleaned for agreements");
    },

    async deleteBatchAgreementDocument(
      dbContext: DBContext,
      records: AgreementConsumerDocumentDeletingSchema[]
    ) {
      await dbContext.conn.tx(async (t) => {
        for (const batch of batchMessages(
          records,
          config.dbMessagesToInsertPerBatch
        )) {
          await docRepository.insertDeleting(t, dbContext.pgp, batch);
          genericLogger.info(
            `Staging deletion inserted for agreement document ids: ${batch
              .map((r) => r.id)
              .join(", ")}`
          );
        }

        await docRepository.mergeDeleting(t);
      });

      genericLogger.info(
        "Staging deletion merged into target tables for agreement documents"
      );

      await docRepository.cleanDeleting();

      genericLogger.info(
        "Staging deleting data cleaned for agreement documents"
      );
    },
  };
}

export type AgreementService = ReturnType<typeof agreementServiceBuilder>;
