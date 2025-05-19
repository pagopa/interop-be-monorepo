/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable functional/immutable-data */
import { genericLogger } from "pagopa-interop-commons";
import { DBContext } from "../db/db.js";
import { batchMessages } from "../utils/batchHelper.js";
import { mergeDeletingCascadeById } from "../utils/sqlQueryHelper.js";
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

export function purposeServiceBuilder(db: DBContext) {
  const purposeRepository = purposeRepo(db.conn);
  const versionRepository = purposeVersionRepo(db.conn);
  const versionDocumentRepository = purposeVersionDocumentRepo(db.conn);
  const formRepository = purposeRiskAnalysisFormRepo(db.conn);
  const answerRepository = purposeRiskAnalysisAnswerRepo(db.conn);

  return {
    async upsertBatchPurpose(ctx: DBContext, items: PurposeItemsSchema[]) {
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
          riskAnalysisFormSQL: batch.flatMap(
            (item) => item.riskAnalysisFormSQL ?? []
          ),
          riskAnalysisAnswersSQL: batch.flatMap(
            (item) => item.riskAnalysisAnswersSQL ?? []
          ),
        };

        await ctx.conn.tx(async (t) => {
          if (batchItems.purposeSQL.length) {
            await purposeRepository.insert(t, ctx.pgp, batchItems.purposeSQL);
          }
          if (batchItems.versionsSQL.length) {
            await versionRepository.insert(t, ctx.pgp, batchItems.versionsSQL);
          }
          if (batchItems.versionDocumentsSQL.length) {
            await versionDocumentRepository.insert(
              t,
              ctx.pgp,
              batchItems.versionDocumentsSQL
            );
          }
          if (batchItems.riskAnalysisFormSQL.length) {
            await formRepository.insert(
              t,
              ctx.pgp,
              batchItems.riskAnalysisFormSQL
            );
          }
          if (batchItems.riskAnalysisAnswersSQL.length) {
            await answerRepository.insert(
              t,
              ctx.pgp,
              batchItems.riskAnalysisAnswersSQL
            );
          }
        });
        genericLogger.info(
          `Staging data inserted for batch of ${batchItems.purposeSQL.length} purposes`
        );
      }

      await ctx.conn.tx(async (t) => {
        await purposeRepository.merge(t);
        await versionRepository.merge(t);
        await versionDocumentRepository.merge(t);
        await formRepository.merge(t);
        await answerRepository.merge(t);
      });
      genericLogger.info(
        `Staging data merged into target tables for all batches`
      );

      await purposeRepository.clean();
      await versionRepository.clean();
      await versionDocumentRepository.clean();
      await formRepository.clean();
      await answerRepository.clean();
      genericLogger.info(`Staging data cleaned`);
    },

    async upsertBatchPurposeVersion(
      ctx: DBContext,
      items: PurposeVersionItemsSchema[]
    ) {
      for (const batch of batchMessages(
        items,
        config.dbMessagesToInsertPerBatch
      )) {
        const batchItems = {
          purposeVersions: batch.flatMap((item) => item.versionSQL),
          versionDocuments: batch.flatMap(
            (item) => item.versionDocumentSQL ?? []
          ),
        };

        await ctx.conn.tx(async (t) => {
          if (batchItems.purposeVersions.length) {
            await versionRepository.insert(
              t,
              ctx.pgp,
              batchItems.purposeVersions
            );
          }
          if (batchItems.versionDocuments.length) {
            await versionDocumentRepository.insert(
              t,
              ctx.pgp,
              batchItems.versionDocuments
            );
          }
        });
        genericLogger.info(
          `Staging data inserted for batch of ${batchItems.purposeVersions.length} purpose versions`
        );
      }

      await ctx.conn.tx(async (t) => {
        await versionRepository.merge(t);
        await versionDocumentRepository.merge(t);
      });
      genericLogger.info(
        `Staging data merged into target tables for all batches`
      );

      await versionRepository.clean();
      await versionDocumentRepository.clean();
      genericLogger.info(`Staging data cleaned for purpose versions`);
    },

    async deleteBatchPurpose(ctx: DBContext, records: PurposeDeletingSchema[]) {
      await ctx.conn.tx(async (t) => {
        for (const batch of batchMessages(
          records,
          config.dbMessagesToInsertPerBatch
        )) {
          await purposeRepository.insertDeleting(t, ctx.pgp, batch);
          genericLogger.info(
            `Staging deletion inserted for purposeIds: ${batch.join(", ")}`
          );
        }
      });

      await ctx.conn.tx(async (t) => {
        await purposeRepository.mergeDeleting(t);
        await mergeDeletingCascadeById(
          t,
          "purposeId",
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

      await purposeRepository.cleanDeleting();
      genericLogger.info(`Staging deleting tables cleaned for purposes`);
    },

    async deleteBatchPurposeVersion(
      ctx: DBContext,
      records: PurposeVersionDeletingSchema[]
    ) {
      await ctx.conn.tx(async (t) => {
        for (const batch of batchMessages(
          records,
          config.dbMessagesToInsertPerBatch
        )) {
          await versionRepository.insertDeleting(t, ctx.pgp, batch);
          genericLogger.info(
            `Staging deletion inserted for purposeVersionIds: ${batch.join(
              ", "
            )}`
          );
        }
      });

      await ctx.conn.tx(async (t) => {
        await versionRepository.mergeDeleting(t);
        await mergeDeletingCascadeById(
          t,
          "purposeVersionId",
          [PurposeDbTable.purpose_version_document],
          DeletingDbTable.purpose_deleting_table
        );
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
