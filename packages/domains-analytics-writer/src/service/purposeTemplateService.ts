/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable functional/immutable-data */
/* eslint-disable sonarjs/cognitive-complexity */
import { genericLogger } from "pagopa-interop-commons";
import { DBContext } from "../db/db.js";
import { PurposeTemplateDbTable } from "../model/db/index.js";
import { batchMessages } from "../utils/batchHelper.js";
import { cleaningTargetTables } from "../utils/sqlQueryHelper.js";
import { config } from "../config/config.js";
import { PurposeTemplateItemsSchema } from "../model/purposeTemplate/purposeTemplate.js";
import { purposeTemplateRepository } from "../repository/purposeTemplate/purposeTemplate.repository.js";
import { purposeTemplateRiskAnalysisAnswerRepository } from "../repository/purposeTemplate/purposeTemplateRiskAnalysisAnswer.repository.js";
import { purposeTemplateRiskAnalysisAnswerAnnotationRepository } from "../repository/purposeTemplate/purposeTemplateRiskAnalysisAnswerAnnotation.repository.js";
import { purposeTemplateRiskAnalysisAnswerAnnotationDocumentRepository } from "../repository/purposeTemplate/purposeTemplateRiskAnalysisAnswerAnnotationDocument.repository.js";
import { purposeTemplateRiskAnalysisFormRepository } from "../repository/purposeTemplate/purposeTemplateRiskAnalysisForm.repository.js";

export function purposeTemplateServiceBuilder(db: DBContext) {
  const templateRepo = purposeTemplateRepository(db.conn);
  const formRepo = purposeTemplateRiskAnalysisFormRepository(db.conn);
  const answerRepo = purposeTemplateRiskAnalysisAnswerRepository(db.conn);
  const annotationRepo = purposeTemplateRiskAnalysisAnswerAnnotationRepository(
    db.conn
  );
  const documentRepo =
    purposeTemplateRiskAnalysisAnswerAnnotationDocumentRepository(db.conn);

  return {
    async upsertBatchPurposeTemplate(
      dbContext: DBContext,
      items: PurposeTemplateItemsSchema[]
    ): Promise<void> {
      await dbContext.conn.tx(async (t) => {
        for (const batch of batchMessages(
          items,
          config.dbMessagesToInsertPerBatch
        )) {
          const batchItems = {
            templateSQL: batch.map((i) => i.purposeTemplateSQL),
            riskAnalysisFormTemplateSQL: batch.flatMap(
              (item) => item.riskAnalysisFormTemplateSQL ?? []
            ),
            riskAnalysisTemplateAnswersSQL: batch.flatMap(
              (item) => item.riskAnalysisTemplateAnswersSQL
            ),
            riskAnalysisTemplateAnswersAnnotationsSQL: batch.flatMap(
              (item) => item.riskAnalysisTemplateAnswersAnnotationsSQL
            ),
            riskAnalysisTemplateAnswersAnnotationsDocumentsSQL: batch.flatMap(
              (item) => item.riskAnalysisTemplateAnswersAnnotationsDocumentsSQL
            ),
          };

          if (batchItems.templateSQL.length) {
            await templateRepo.insert(t, dbContext.pgp, batchItems.templateSQL);
          }
          if (batchItems.riskAnalysisFormTemplateSQL.length) {
            await formRepo.insert(
              t,
              dbContext.pgp,
              batchItems.riskAnalysisFormTemplateSQL
            );
          }
          if (batchItems.riskAnalysisTemplateAnswersSQL.length) {
            await answerRepo.insert(
              t,
              dbContext.pgp,
              batchItems.riskAnalysisTemplateAnswersSQL
            );
          }
          if (batchItems.riskAnalysisTemplateAnswersAnnotationsSQL.length) {
            await annotationRepo.insert(
              t,
              dbContext.pgp,
              batchItems.riskAnalysisTemplateAnswersAnnotationsSQL
            );
          }
          if (
            batchItems.riskAnalysisTemplateAnswersAnnotationsDocumentsSQL.length
          ) {
            await documentRepo.insert(
              t,
              dbContext.pgp,
              batchItems.riskAnalysisTemplateAnswersAnnotationsDocumentsSQL
            );
          }

          genericLogger.info(
            `Staged purpose template batch: ${batch
              .map((i) => i.purposeTemplateSQL.id)
              .join(", ")}`
          );
        }

        await templateRepo.merge(t);
        await formRepo.merge(t);
        await answerRepo.merge(t);
        await annotationRepo.merge(t);
        await documentRepo.merge(t);
      });

      await dbContext.conn.tx(async (t) => {
        await cleaningTargetTables(
          t,
          "purposeTemplateId",
          [
            PurposeTemplateDbTable.purpose_template_risk_analysis_answer_annotation_document,
            PurposeTemplateDbTable.purpose_template_risk_analysis_answer_annotation,
            PurposeTemplateDbTable.purpose_template_risk_analysis_answer,
            PurposeTemplateDbTable.purpose_template_risk_analysis_form,
          ],
          PurposeTemplateDbTable.purpose_template
        );
      });

      genericLogger.info(`Merged all staged purpose template data`);

      await templateRepo.clean();
      await formRepo.clean();
      await answerRepo.clean();
      await annotationRepo.clean();
      await documentRepo.clean();

      genericLogger.info(`Cleaned all purpose template staging tables`);
    },
  };
}

export type PurposeTemplateService = ReturnType<
  typeof purposeTemplateServiceBuilder
>;
