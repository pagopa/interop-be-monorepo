/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable functional/immutable-data */
import { genericLogger } from "pagopa-interop-commons";
import {
  PurposeItemsSQL,
  PurposeVersionSQL,
  PurposeVersionDocumentSQL,
} from "pagopa-interop-readmodel-models";
import { DBContext } from "../db/db.js";
import { purposeRepository } from "../repository/purpose/purpose.repository.js";
import { purposeVersionRepository } from "../repository/purpose/purposeVersion.repository.js";
import { purposeVersionDocumentRepository } from "../repository/purpose/purposeVersionDocument.repository.js";
import { purposeRiskAnalysisFormRepository } from "../repository/purpose/purposeRiskAnalysisForm.repository.js";
import { purposeRiskAnalysisAnswerRepository } from "../repository/purpose/purposeRiskAnalysisAnswer.repository.js";
import { batchMessages } from "../utils/batchHelper.js";
import { mergeDeletingCascadeById } from "../utils/sqlQueryHelper.js";
import { PurposeDbTable, DeletingDbTable } from "../model/db.js";
import { config } from "../config/config.js";

export function purposeServiceBuilder(db: DBContext) {
  const purposeRepo = purposeRepository(db.conn);
  const versionRepo = purposeVersionRepository(db.conn);
  const versionDocumentRepo = purposeVersionDocumentRepository(db.conn);
  const formRepo = purposeRiskAnalysisFormRepository(db.conn);
  const answerRepo = purposeRiskAnalysisAnswerRepository(db.conn);

  return {
    async upsertBatchPurpose(
      upsertBatch: PurposeItemsSQL[],
      dbContext: DBContext
    ) {
      for (const batch of batchMessages(
        upsertBatch,
        config.dbMessagesToInsertPerBatch
      )) {
        const toInsertPurpose = batch.map((item) => item.purposeSQL);
        const toInsertForm = batch
          .map((item) => item.riskAnalysisFormSQL)
          .filter((f): f is NonNullable<typeof f> => !!f);
        const toInsertAnswers = batch.flatMap(
          (item) => item.riskAnalysisAnswersSQL ?? []
        );

        await dbContext.conn.tx(async (t) => {
          if (toInsertPurpose.length) {
            await purposeRepo.insert(t, dbContext.pgp, toInsertPurpose);
          }
          if (toInsertForm.length) {
            await formRepo.insert(t, dbContext.pgp, toInsertForm);
          }
          if (toInsertAnswers.length) {
            await answerRepo.insert(t, dbContext.pgp, toInsertAnswers);
          }
        });
        genericLogger.info(
          `Staging data inserted for batch of ${toInsertPurpose.length} purposes (with ${toInsertForm.length} forms and ${toInsertAnswers.length} answers)`
        );
      }

      await dbContext.conn.tx(async (t) => {
        await purposeRepo.merge(t);
        await formRepo.merge(t);
        await answerRepo.merge(t);
      });
      genericLogger.info(
        `Staging data merged into purpose, purpose_risk_analysis_form, and purpose_risk_analysis_answer tables`
      );

      await purposeRepo.clean();
      await formRepo.clean();
      await answerRepo.clean();
      genericLogger.info(`Staging data cleaned for purposes and risk analyses`);
    },

    async upsertBatchPurposeVersion(
      items: Array<{
        versionSQL: PurposeVersionSQL;
        versionDocumentSQL?: PurposeVersionDocumentSQL;
      }>,
      dbContext: DBContext
    ) {
      for (const batch of batchMessages(
        items,
        config.dbMessagesToInsertPerBatch
      )) {
        const toInsertVersions = batch.map((i) => i.versionSQL);
        const toInsertDocs = batch
          .map((i) => i.versionDocumentSQL)
          .filter((d): d is NonNullable<typeof d> => !!d);

        await dbContext.conn.tx(async (t) => {
          if (toInsertVersions.length) {
            await versionRepo.insert(t, dbContext.pgp, toInsertVersions);
          }
          if (toInsertDocs.length) {
            await versionDocumentRepo.insert(t, dbContext.pgp, toInsertDocs);
          }
        });
        genericLogger.info(
          `Staging data inserted for batch of purpose versions: ${toInsertVersions
            .map((v) => v.id)
            .join(", ")}`
        );
      }

      await dbContext.conn.tx(async (t) => {
        await versionRepo.merge(t);
        await versionDocumentRepo.merge(t);
      });
      genericLogger.info(
        `Staging data merged into purpose_version and purpose_version_document tables`
      );

      await versionRepo.clean();
      await versionDocumentRepo.clean();
      genericLogger.info(`Staging data cleaned for purpose versions`);
    },

    async deleteBatchPurpose(purposeIds: string[], dbContext: DBContext) {
      await dbContext.conn.tx(async (t) => {
        for (const batch of batchMessages(
          purposeIds,
          config.dbMessagesToInsertPerBatch
        )) {
          await purposeRepo.insertDeleting(t, dbContext.pgp, batch);
          genericLogger.info(
            `Staging deletion inserted for purposeIds: ${batch.join(", ")}`
          );
        }
      });

      await dbContext.conn.tx(async (t) => {
        await purposeRepo.mergeDeleting(t);
        await mergeDeletingCascadeById(
          t,
          "purpose_id",
          [
            PurposeDbTable.purpose_version,
            PurposeDbTable.purpose_version_document,
            PurposeDbTable.purpose_risk_analysis_form,
            PurposeDbTable.purpose_risk_analysis_answer,
          ],
          DeletingDbTable.purpose_deleting_table
        );
      });
      genericLogger.info(
        `Staging deletion merged into target tables for all purposes`
      );

      await purposeRepo.cleanDeleting();
      genericLogger.info(`Staging deleting tables cleaned for purposes`);
    },

    async deleteBatchPurposeVersion(
      versionIds: string[],
      dbContext: DBContext
    ) {
      await dbContext.conn.tx(async (t) => {
        for (const batch of batchMessages(
          versionIds,
          config.dbMessagesToInsertPerBatch
        )) {
          await versionRepo.insertDeleting(t, dbContext.pgp, batch);
          genericLogger.info(
            `Staging deletion inserted for purposeVersionIds: ${batch.join(
              ", "
            )}`
          );
        }
      });

      await dbContext.conn.tx(async (t) => {
        await versionRepo.mergeDeleting(t);
        await mergeDeletingCascadeById(
          t,
          "purpose_version_id",
          [PurposeDbTable.purpose_version_document],
          DeletingDbTable.purpose_deleting_table
        );
      });
      genericLogger.info(
        `Staging deletion merged into target tables for all purpose versions`
      );

      await versionRepo.cleanDeleting();
      genericLogger.info(
        `Staging deleting tables cleaned for purpose versions`
      );
    },
  };
}

export type PurposeService = ReturnType<typeof purposeServiceBuilder>;
