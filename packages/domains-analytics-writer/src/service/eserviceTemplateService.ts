/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable functional/immutable-data */
/* eslint-disable sonarjs/cognitive-complexity */
import { genericLogger } from "pagopa-interop-commons";
import { DBContext } from "../db/db.js";
import { EserviceTemplateDbTable, DeletingDbTable } from "../model/db/index.js";
import { batchMessages } from "../utils/batchHelper.js";
import {
  cleaningTargetTables,
  mergeDeletingCascadeById,
} from "../utils/sqlQueryHelper.js";
import { config } from "../config/config.js";
import {
  EserviceTemplateItemsSchema,
  EserviceTemplateDeletingSchema,
} from "../model/eserviceTemplate/eserviceTemplate.js";
import { eserviceTemplateRepository } from "../repository/eserviceTemplate/eserviceTemplate.repository.js";
import { eserviceTemplateVersionRepository } from "../repository/eserviceTemplate/eserviceTemplateVersion.repository.js";
import { eserviceTemplateVersionDocumentRepository } from "../repository/eserviceTemplate/eserviceTemplateVersionDocument.repository.js";
import { eserviceTemplateVersionInterfaceRepository } from "../repository/eserviceTemplate/eserviceTemplateVersionInterface.repository.js";
import { eserviceTemplateRiskAnalysisRepository } from "../repository/eserviceTemplate/eserviceTemplateRiskAnalysis.repository.js";
import { eserviceTemplateRiskAnalysisAnswerRepository } from "../repository/eserviceTemplate/eserviceTemplateRiskAnalysisAnswer.repository.js";
import { eserviceTemplateVersionAttributeRepository } from "../repository/eserviceTemplate/eserviceTemplateVersionAttribute.repository.js";

export function eserviceTemplateServiceBuilder(db: DBContext) {
  const templateRepo = eserviceTemplateRepository(db.conn);
  const versionRepo = eserviceTemplateVersionRepository(db.conn);
  const interfaceRepo = eserviceTemplateVersionInterfaceRepository(db.conn);
  const documentRepo = eserviceTemplateVersionDocumentRepository(db.conn);
  const attributeRepo = eserviceTemplateVersionAttributeRepository(db.conn);
  const riskRepo = eserviceTemplateRiskAnalysisRepository(db.conn);
  const riskAnswerRepo = eserviceTemplateRiskAnalysisAnswerRepository(db.conn);

  return {
    async upsertBatchEserviceTemplate(
      dbContext: DBContext,
      items: EserviceTemplateItemsSchema[]
    ): Promise<void> {
      await dbContext.conn.tx(async (t) => {
        for (const batch of batchMessages(
          items,
          config.dbMessagesToInsertPerBatch
        )) {
          const batchItems = {
            templateSQL: batch.map((item) => item.eserviceTemplateSQL),
            versionsSQL: batch.flatMap((item) => item.versionsSQL),
            interfacesSQL: batch.flatMap((item) => item.interfacesSQL),
            documentsSQL: batch.flatMap((item) => item.documentsSQL),
            attributesSQL: batch.flatMap((item) => item.attributesSQL),
            riskAnalysesSQL: batch.flatMap((item) => item.riskAnalysesSQL),
            riskAnalysisAnswersSQL: batch.flatMap(
              (item) => item.riskAnalysisAnswersSQL
            ),
          };
          if (batchItems.templateSQL.length) {
            await templateRepo.insert(t, dbContext.pgp, batchItems.templateSQL);
          }
          if (batchItems.versionsSQL.length) {
            await versionRepo.insert(t, dbContext.pgp, batchItems.versionsSQL);
          }
          if (batchItems.interfacesSQL.length) {
            await interfaceRepo.insert(
              t,
              dbContext.pgp,
              batchItems.interfacesSQL
            );
          }
          if (batchItems.documentsSQL.length) {
            await documentRepo.insert(
              t,
              dbContext.pgp,
              batchItems.documentsSQL
            );
          }
          if (batchItems.attributesSQL.length) {
            await attributeRepo.insert(
              t,
              dbContext.pgp,
              batchItems.attributesSQL
            );
          }
          if (batchItems.riskAnalysesSQL.length) {
            await riskRepo.insert(t, dbContext.pgp, batchItems.riskAnalysesSQL);
          }
          if (batchItems.riskAnalysisAnswersSQL.length) {
            await riskAnswerRepo.insert(
              t,
              dbContext.pgp,
              batchItems.riskAnalysisAnswersSQL
            );
          }

          genericLogger.info(
            `Staged template batch: ${batch
              .map((i) => i.eserviceTemplateSQL.id)
              .join(", ")}`
          );
        }

        await templateRepo.merge(t);
        await versionRepo.merge(t);
        await interfaceRepo.merge(t);
        await attributeRepo.merge(t);
        await documentRepo.merge(t);
        await riskRepo.merge(t);
        await riskAnswerRepo.merge(t);
      });

      await dbContext.conn.tx(async (t) => {
        await cleaningTargetTables(
          t,
          "eserviceTemplateId",
          [
            EserviceTemplateDbTable.eservice_template_risk_analysis_answer,
            EserviceTemplateDbTable.eservice_template_risk_analysis,
            EserviceTemplateDbTable.eservice_template_version_attribute,
            EserviceTemplateDbTable.eservice_template_version_document,
            EserviceTemplateDbTable.eservice_template_version_interface,
            EserviceTemplateDbTable.eservice_template_version,
          ],
          EserviceTemplateDbTable.eservice_template
        );
      });

      genericLogger.info(`Merged all staged template data`);

      await templateRepo.clean();
      await versionRepo.clean();
      await interfaceRepo.clean();
      await attributeRepo.clean();
      await documentRepo.clean();
      await riskRepo.clean();
      await riskAnswerRepo.clean();

      genericLogger.info(`Cleaned all staging tables`);
    },

    async deleteBatchEserviceTemplate(
      dbContext: DBContext,
      items: EserviceTemplateDeletingSchema[]
    ): Promise<void> {
      await dbContext.conn.tx(async (t) => {
        for (const batch of batchMessages(
          items,
          config.dbMessagesToInsertPerBatch
        )) {
          await templateRepo.insertDeleting(t, dbContext.pgp, batch);
          genericLogger.info(
            `Staged template deletions: ${batch.map((i) => i.id).join(", ")}`
          );
        }

        await templateRepo.mergeDeleting(t);
        await mergeDeletingCascadeById(
          t,
          "eserviceTemplateId",
          [
            EserviceTemplateDbTable.eservice_template_version,
            EserviceTemplateDbTable.eservice_template_version_interface,
            EserviceTemplateDbTable.eservice_template_version_document,
            EserviceTemplateDbTable.eservice_template_version_attribute,
            EserviceTemplateDbTable.eservice_template_risk_analysis,
            EserviceTemplateDbTable.eservice_template_risk_analysis_answer,
          ],
          DeletingDbTable.eservice_template_deleting_table
        );
      });

      genericLogger.info(`Merged template deletions into target tables`);

      await templateRepo.cleanDeleting();
      genericLogger.info(`Cleaned template deleting staging`);
    },
  };
}
