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
import { DeletingDbTable } from "../model/db/deleting.js";
import { PurposeDbTable } from "../model/db/purpose.js";
import {
  PurposeDeletingSchema,
  PurposeItemsSchema,
} from "../model/purpose/purpose.js";
import {
  PurposeVersionDeletingSchema,
  PurposeVersionItemsSchema,
} from "../model/purpose/purposeVersion.js";
import { purposeRiskAnalysisAnswerRepo } from "../repository/purpose/purposeRiskAnalysisAnswer.repository.js";
import { purposeRiskAnalysisFormRepo } from "../repository/purpose/purposeRiskAnalysisForm.repository.js";
import { purposeVersionRepo } from "../repository/purpose/purposeVersion.repository.js";
import { purposeVersionDocumentRepo } from "../repository/purpose/purposeVersionDocument.repository.js";
import { purposeRepo } from "../repository/purpose/purpose.repository.js";
import { purposeVersionStampRepo } from "../repository/purpose/purposeVersionStamp.repository.js";

export function purposeServiceBuilder(db: DBContext) {
  const purposeRepository = purposeRepo(db.conn);
  const versionRepository = purposeVersionRepo(db.conn);
  const versionDocumentRepository = purposeVersionDocumentRepo(db.conn);
  const versionStampRepository = purposeVersionStampRepo(db.conn);
  const formRepository = purposeRiskAnalysisFormRepo(db.conn);
  const answerRepository = purposeRiskAnalysisAnswerRepo(db.conn);

  return {
    async upsertBatchPurpose(
      dbContext: DBContext,
      items: PurposeItemsSchema[]
    ) {
      await dbContext.conn.tx(async (t) => {
        for (const batch of batchMessages(
          items,
          config.dbMessagesToInsertPerBatch
        )) {
          const batchItems = {
            purposeSQL: batch.map((item) => item.purposeSQL),
            versionsSQL: batch.flatMap((item) => item.versionsSQL),
            versionDocumentsSQL: batch.flatMap(
              (item) => item.versionDocumentsSQL
            ),
            versionStampsSQL: batch.flatMap((item) => item.versionStampsSQL),
            riskAnalysisFormSQL: batch.flatMap(
              (item) => item.riskAnalysisFormSQL ?? []
            ),
            riskAnalysisAnswersSQL: batch.flatMap(
              (item) => item.riskAnalysisAnswersSQL ?? []
            ),
          };

          if (batchItems.purposeSQL.length) {
            await purposeRepository.insert(
              t,
              dbContext.pgp,
              batchItems.purposeSQL
            );
          }
          if (batchItems.versionsSQL.length) {
            await versionRepository.insert(
              t,
              dbContext.pgp,
              batchItems.versionsSQL
            );
          }
          if (batchItems.versionDocumentsSQL.length) {
            await versionDocumentRepository.insert(
              t,
              dbContext.pgp,
              batchItems.versionDocumentsSQL
            );
          }
          if (batchItems.versionStampsSQL.length) {
            await versionStampRepository.insert(
              t,
              dbContext.pgp,
              batchItems.versionStampsSQL
            );
          }
          if (batchItems.riskAnalysisFormSQL.length) {
            await formRepository.insert(
              t,
              dbContext.pgp,
              batchItems.riskAnalysisFormSQL
            );
          }
          if (batchItems.riskAnalysisAnswersSQL.length) {
            await answerRepository.insert(
              t,
              dbContext.pgp,
              batchItems.riskAnalysisAnswersSQL
            );
          }
          genericLogger.info(
            `Staging data inserted for batch of ${batchItems.purposeSQL.length} purposes`
          );
        }

        await purposeRepository.merge(t);
        await versionRepository.merge(t);
        await versionDocumentRepository.merge(t);
        await versionStampRepository.merge(t);
        await formRepository.merge(t);
        await answerRepository.merge(t);
      });

      await dbContext.conn.tx(async (t) => {
        await cleaningTargetTables(
          t,
          "purposeId",
          [
            PurposeDbTable.purpose_version_stamp,
            PurposeDbTable.purpose_version_document,
            PurposeDbTable.purpose_version,
            PurposeDbTable.purpose_risk_analysis_answer,
            PurposeDbTable.purpose_risk_analysis_form,
          ],
          PurposeDbTable.purpose
        );
      });

      genericLogger.info(
        `Staging data merged into target tables for all batches`
      );

      await purposeRepository.clean();
      await versionRepository.clean();
      await versionDocumentRepository.clean();
      await versionStampRepository.clean();
      await formRepository.clean();
      await answerRepository.clean();
      genericLogger.info(`Staging data cleaned`);
    },

    async upsertBatchPurposeVersion(
      dbContext: DBContext,
      items: PurposeVersionItemsSchema[]
    ) {
      await dbContext.conn.tx(async (t) => {
        for (const batch of batchMessages(
          items,
          config.dbMessagesToInsertPerBatch
        )) {
          const batchItems = {
            purposeVersion: batch.map((item) => item.versionSQL),
            versionDocument: batch.flatMap((item) =>
              item.versionDocumentSQL ? [item.versionDocumentSQL] : []
            ),
          };

          if (batchItems.purposeVersion.length) {
            await versionRepository.insert(
              t,
              dbContext.pgp,
              batchItems.purposeVersion
            );
          }
          if (batchItems.versionDocument.length) {
            await versionDocumentRepository.insert(
              t,
              dbContext.pgp,
              batchItems.versionDocument
            );
          }
          genericLogger.info(
            `Staging data inserted for batch of ${batchItems.purposeVersion.length} purpose versions`
          );
        }

        await versionRepository.merge(t);
        await versionDocumentRepository.merge(t);
      });

      await dbContext.conn.tx(async (t) => {
        await cleaningTargetTables(
          t,
          "purposeVersionId",
          [PurposeDbTable.purpose_version_document],
          PurposeDbTable.purpose_version
        );
      });

      genericLogger.info(
        `Staging data merged into target tables for all batches`
      );

      await versionRepository.clean();
      await versionDocumentRepository.clean();
      genericLogger.info(`Staging data cleaned for purpose versions`);
    },

    async deleteBatchPurpose(
      dbContext: DBContext,
      records: PurposeDeletingSchema[]
    ) {
      await dbContext.conn.tx(async (t) => {
        for (const batch of batchMessages(
          records,
          config.dbMessagesToInsertPerBatch
        )) {
          await purposeRepository.insertDeleting(t, dbContext.pgp, batch);
          genericLogger.info(
            `Staging deletion inserted for purposeIds: ${batch
              .map((r) => r.id)
              .join(", ")}`
          );
        }

        await purposeRepository.mergeDeleting(t);
        await mergeDeletingCascadeById(
          t,
          "purposeId",
          [
            PurposeDbTable.purpose_version,
            PurposeDbTable.purpose_version_document,
            PurposeDbTable.purpose_version_stamp,
            PurposeDbTable.purpose_risk_analysis_form,
            PurposeDbTable.purpose_risk_analysis_answer,
          ],
          DeletingDbTable.purpose_deleting_table
        );
      });
      genericLogger.info(
        `Staging deletion merged into target tables for all purposes`
      );

      await purposeRepository.cleanDeleting();
      genericLogger.info(`Staging deleting tables cleaned for purposes`);
    },

    async deleteBatchPurposeVersion(
      dbContext: DBContext,
      records: PurposeVersionDeletingSchema[]
    ) {
      await dbContext.conn.tx(async (t) => {
        for (const batch of batchMessages(
          records,
          config.dbMessagesToInsertPerBatch
        )) {
          await versionRepository.insertDeleting(t, dbContext.pgp, batch);
          genericLogger.info(
            `Staging deletion inserted for purposeVersionIds: ${batch
              .map((r) => r.id)
              .join(", ")}`
          );
        }

        await mergeDeletingCascadeById(
          t,
          "purposeVersionId",
          [
            PurposeDbTable.purpose_version_document,
            PurposeDbTable.purpose_version_stamp,
          ],
          DeletingDbTable.purpose_deleting_table,
          true
        );
        await versionRepository.mergeDeleting(t);
      });
      genericLogger.info(
        `Staging deletion merged into target tables for all purpose versions`
      );

      await versionRepository.cleanDeleting();
      genericLogger.info(
        `Staging deleting tables cleaned for purpose versions`
      );
    },
  };
}

export type PurposeService = ReturnType<typeof purposeServiceBuilder>;
