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
import { purposeTemplateEServiceDescriptorVersionRepository } from "../repository/purposeTemplate/purposeTemplateEServiceDescriptorVersion.repository.js";
import { purposeTemplateRiskAnalysisAnswerRepository } from "../repository/purposeTemplate/purposeTemplateRiskAnalysisAnswer.repository.js";
import { purposeTemplateRiskAnalysisAnswerAnnotationRepository } from "../repository/purposeTemplate/purposeTemplateRiskAnalysisAnswerAnnotation.repository.js";
import { purposeTemplateRiskAnalysisAnswerAnnotationDocumentRepository } from "../repository/purposeTemplate/purposeTemplateRiskAnalysisAnswerAnnotationDocument.repository.js";
import { purposeTemplateRiskAnalysisFormRepository } from "../repository/purposeTemplate/purposeTemplateRiskAnalysisForm.repository.js";

export function purposeTemplateServiceBuilder(db: DBContext) {
  const templateRepo = purposeTemplateRepository(db.conn);
  const eserviceRepo = purposeTemplateEServiceDescriptorVersionRepository(
    db.conn
  );
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
            eserviceDescriptorVersionsSQL: batch.flatMap(
              (item) => item.eserviceDescriptorVersionsSQL
            ),
            riskAnalysisFormSQL: batch.flatMap(
              (item) => item.riskAnalysisFormSQL ?? []
            ),
            riskAnalysisAnswersSQL: batch.flatMap(
              (item) => item.riskAnalysisAnswersSQL
            ),
            riskAnalysisAnswerAnnotationsSQL: batch.flatMap(
              (item) => item.riskAnalysisAnswerAnnotationsSQL
            ),
            riskAnalysisAnswerAnnotationDocumentsSQL: batch.flatMap(
              (item) => item.riskAnalysisAnswerAnnotationDocumentsSQL
            ),
          };

          if (batchItems.templateSQL.length) {
            await templateRepo.insert(t, dbContext.pgp, batchItems.templateSQL);
          }
          if (batchItems.eserviceDescriptorVersionsSQL.length) {
            await eserviceRepo.insert(
              t,
              dbContext.pgp,
              batchItems.eserviceDescriptorVersionsSQL
            );
          }
          if (batchItems.riskAnalysisFormSQL.length) {
            await formRepo.insert(
              t,
              dbContext.pgp,
              batchItems.riskAnalysisFormSQL
            );
          }
          if (batchItems.riskAnalysisAnswersSQL.length) {
            await answerRepo.insert(
              t,
              dbContext.pgp,
              batchItems.riskAnalysisAnswersSQL
            );
          }
          if (batchItems.riskAnalysisAnswerAnnotationsSQL.length) {
            await annotationRepo.insert(
              t,
              dbContext.pgp,
              batchItems.riskAnalysisAnswerAnnotationsSQL
            );
          }
          if (batchItems.riskAnalysisAnswerAnnotationDocumentsSQL.length) {
            await documentRepo.insert(
              t,
              dbContext.pgp,
              batchItems.riskAnalysisAnswerAnnotationDocumentsSQL
            );
          }

          genericLogger.info(
            `Staged purpose template batch: ${batch
              .map((i) => i.purposeTemplateSQL.id)
              .join(", ")}`
          );
        }

        await templateRepo.merge(t);
        await eserviceRepo.merge(t);
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
            PurposeTemplateDbTable.purpose_template_eservice_descriptor_version,
          ],
          PurposeTemplateDbTable.purpose_template
        );
      });

      genericLogger.info(`Merged all staged purpose template data`);

      await templateRepo.clean();
      await eserviceRepo.clean();
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
