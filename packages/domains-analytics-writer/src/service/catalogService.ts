/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable functional/immutable-data */
import { genericLogger } from "pagopa-interop-commons";
import { EServiceId } from "pagopa-interop-models";
import {
  EServiceDescriptorAttributeSQL,
  EServiceDescriptorDocumentSQL,
  EServiceDescriptorInterfaceSQL,
  EServiceDescriptorRejectionReasonSQL,
  EServiceDescriptorSQL,
  EServiceDescriptorTemplateVersionRefSQL,
  EServiceItemsSQL,
} from "pagopa-interop-readmodel-models";
import { DBContext } from "../db/db.js";
import { eserviceRiskAnalysisAnswerRepository } from "../repository/catalog/eserviceRiskAnalysisAnswer.repository.js";
import { eserviceRiskAnalysisRepository } from "../repository/catalog/eserviceRiskAnalysis.repository.js";
import { eserviceDescriptorAttributeRepository } from "../repository/catalog/eserviceDescriptorAttribute.repository.js";
import { eserviceDescriptorDocumentRepository } from "../repository/catalog/eserviceDescriptorDocument.repository.js";
import { eserviceDescriptorInterfaceRepository } from "../repository/catalog/eserviceDescriptorInterface.repository.js";
import { eserviceDescriptorRejectionRepository } from "../repository/catalog/eserviceDescriptorRejection.repository.js";
import { eserviceDescriptorTemplateVersionRefRepository } from "../repository/catalog/eserviceDescriptorTemplateVersionRef.repository.js";
import { eserviceDescriptorRepository } from "../repository/catalog/eserviceDescriptor.repository.js";
import { eserviceRepository } from "../repository/catalog/eservice.repository.js";
import { CatalogDbTable, DeletingDbTable } from "../model/db.js";
import { batchMessages } from "../utils/batchHelper.js";
import { mergeDeletingCascadeById } from "../utils/sqlQueryHelper.js";
import { config } from "../config/config.js";

export function catalogServiceBuilder(db: DBContext) {
  const eserviceRepo = eserviceRepository(db.conn);
  const descriptorRepo = eserviceDescriptorRepository(db.conn);
  const templateVersionRefRepo = eserviceDescriptorTemplateVersionRefRepository(
    db.conn
  );
  const rejectionRepo = eserviceDescriptorRejectionRepository(db.conn);
  const interfaceRepo = eserviceDescriptorInterfaceRepository(db.conn);
  const documentRepo = eserviceDescriptorDocumentRepository(db.conn);
  const attributeRepo = eserviceDescriptorAttributeRepository(db.conn);
  const riskAnalysisRepo = eserviceRiskAnalysisRepository(db.conn);
  const riskAnalysisAnswerRepo = eserviceRiskAnalysisAnswerRepository(db.conn);

  return {
    // eslint-disable-next-line sonarjs/cognitive-complexity
    async upsertBatchEservice(
      upsertBatch: EServiceItemsSQL[],
      dbContext: DBContext
    ) {
      for (const batch of batchMessages(
        upsertBatch,
        config.dbMessagesToInsertPerBatch
      )) {
        const batchItems = {
          eserviceSQL: batch.map((item) => item.eserviceSQL),
          descriptorsSQL: batch.map((item) => item.descriptorsSQL).flat(),
          interfacesSQL: batch.map((item) => item.interfacesSQL).flat(),
          documentsSQL: batch.map((item) => item.documentsSQL).flat(),
          attributesSQL: batch.map((item) => item.attributesSQL).flat(),
          riskAnalysesSQL: batch.map((item) => item.riskAnalysesSQL).flat(),
          riskAnalysisAnswersSQL: batch
            .map((item) => item.riskAnalysisAnswersSQL)
            .flat(),
          rejectionReasonsSQL: batch
            .map((item) => item.rejectionReasonsSQL)
            .flat(),
          templateVersionRefsSQL: batch
            .map((item) => item.templateVersionRefsSQL)
            .flat(),
        };
        await dbContext.conn.tx(async (t) => {
          if (batchItems.eserviceSQL.length) {
            await eserviceRepo.insert(t, dbContext.pgp, batchItems.eserviceSQL);
          }
          if (batchItems.descriptorsSQL.length) {
            await descriptorRepo.insert(
              t,
              dbContext.pgp,
              batchItems.descriptorsSQL
            );
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
            await riskAnalysisRepo.insert(
              t,
              dbContext.pgp,
              batchItems.riskAnalysesSQL
            );
          }
          if (batchItems.riskAnalysisAnswersSQL.length) {
            await riskAnalysisAnswerRepo.insert(
              t,
              dbContext.pgp,
              batchItems.riskAnalysisAnswersSQL
            );
          }
          if (batchItems.rejectionReasonsSQL.length) {
            await rejectionRepo.insert(
              t,
              dbContext.pgp,
              batchItems.rejectionReasonsSQL
            );
          }
          if (batchItems.templateVersionRefsSQL.length) {
            await templateVersionRefRepo.insert(
              t,
              dbContext.pgp,
              batchItems.templateVersionRefsSQL
            );
          }
        });

        genericLogger.info(
          `Staging data inserted for batch of ${batchItems.eserviceSQL.length} eservices`
        );
      }

      await dbContext.conn.tx(async (t) => {
        await eserviceRepo.merge(t);
        await descriptorRepo.merge(t);
        await interfaceRepo.merge(t);
        await documentRepo.merge(t);
        await attributeRepo.merge(t);
        await riskAnalysisRepo.merge(t);
        await riskAnalysisAnswerRepo.merge(t);
        await rejectionRepo.merge(t);
        await templateVersionRefRepo.merge(t);
      });

      genericLogger.info(
        `Staging data merged into target tables for all batches`
      );

      await eserviceRepo.clean();
      await descriptorRepo.clean();
      await interfaceRepo.clean();
      await documentRepo.clean();
      await attributeRepo.clean();
      await riskAnalysisRepo.clean();
      await riskAnalysisAnswerRepo.clean();
      await rejectionRepo.clean();
      await templateVersionRefRepo.clean();

      genericLogger.info(`Staging data cleaned`);
    },

    // eslint-disable-next-line sonarjs/cognitive-complexity
    async upsertBatchEServiceDescriptor(
      items: Array<{
        descriptorData: {
          descriptorSQL: EServiceDescriptorSQL;
          attributesSQL: EServiceDescriptorAttributeSQL[];
          interfaceSQL: EServiceDescriptorInterfaceSQL | undefined;
          documentsSQL: EServiceDescriptorDocumentSQL[];
          rejectionReasonsSQL: EServiceDescriptorRejectionReasonSQL[];
          templateVersionRefSQL:
            | EServiceDescriptorTemplateVersionRefSQL
            | undefined;
        };
        eserviceId: EServiceId;
        metadataVersion: number;
      }>,
      dbContext: DBContext
    ): Promise<void> {
      for (const batch of batchMessages(
        items,
        config.dbMessagesToInsertPerBatch
      )) {
        const batchItems: {
          descriptorSQLArray: EServiceDescriptorSQL[];
          attributesSQLArray: EServiceDescriptorAttributeSQL[];
          interfaceSQLArray: EServiceDescriptorInterfaceSQL[];
          documentsSQLArray: EServiceDescriptorDocumentSQL[];
          rejectionReasonsSQLArray: EServiceDescriptorRejectionReasonSQL[];
          templateVersionRefSQLArray: EServiceDescriptorTemplateVersionRefSQL[];
        } = {
          descriptorSQLArray: [],
          attributesSQLArray: [],
          interfaceSQLArray: [],
          documentsSQLArray: [],
          rejectionReasonsSQLArray: [],
          templateVersionRefSQLArray: [],
        };

        for (const item of batch) {
          const {
            descriptorSQL,
            attributesSQL,
            interfaceSQL,
            documentsSQL,
            rejectionReasonsSQL,
            templateVersionRefSQL,
          } = item.descriptorData;

          batchItems.descriptorSQLArray.push(descriptorSQL);

          if (attributesSQL) {
            batchItems.attributesSQLArray.push(...attributesSQL);
          }

          if (interfaceSQL) {
            batchItems.interfaceSQLArray.push(interfaceSQL);
          }

          if (documentsSQL) {
            batchItems.documentsSQLArray.push(...documentsSQL);
          }

          if (rejectionReasonsSQL) {
            batchItems.rejectionReasonsSQLArray.push(...rejectionReasonsSQL);
          }

          if (templateVersionRefSQL) {
            batchItems.templateVersionRefSQLArray.push(templateVersionRefSQL);
          }
        }

        await dbContext.conn.tx(async (t) => {
          if (batchItems.descriptorSQLArray.length) {
            await descriptorRepo.insert(
              t,
              dbContext.pgp,
              batchItems.descriptorSQLArray
            );
          }

          if (batchItems.attributesSQLArray.length) {
            await attributeRepo.insert(
              t,
              dbContext.pgp,
              batchItems.attributesSQLArray
            );
          }

          if (batchItems.interfaceSQLArray.length) {
            await interfaceRepo.insert(
              t,
              dbContext.pgp,
              batchItems.interfaceSQLArray
            );
          }

          if (batchItems.documentsSQLArray.length) {
            await documentRepo.insert(
              t,
              dbContext.pgp,
              batchItems.documentsSQLArray
            );
          }

          if (batchItems.rejectionReasonsSQLArray.length) {
            await rejectionRepo.insert(
              t,
              dbContext.pgp,
              batchItems.rejectionReasonsSQLArray
            );
          }

          if (batchItems.templateVersionRefSQLArray.length) {
            await templateVersionRefRepo.insert(
              t,
              dbContext.pgp,
              batchItems.templateVersionRefSQLArray
            );
          }
        });

        genericLogger.info(
          `Staging data inserted for batch of descriptors: ${batchItems.descriptorSQLArray
            .map((d) => d.id)
            .join(", ")}`
        );
      }

      await dbContext.conn.tx(async (t) => {
        await descriptorRepo.merge(t);
        await attributeRepo.merge(t);
        await interfaceRepo.merge(t);
        await documentRepo.merge(t);
        await rejectionRepo.merge(t);
        await templateVersionRefRepo.merge(t);
      });

      genericLogger.info(
        "Staging data merged into target tables for all descriptor batches"
      );

      await descriptorRepo.clean();
      await attributeRepo.clean();
      await interfaceRepo.clean();
      await documentRepo.clean();
      await rejectionRepo.clean();
      await templateVersionRefRepo.clean();
    },

    async upsertBatchEServiceDocument(
      documents: EServiceDescriptorDocumentSQL[],
      dbContext: DBContext
    ): Promise<void> {
      for (const batch of batchMessages(
        documents,
        config.dbMessagesToInsertPerBatch
      )) {
        await dbContext.conn.tx(async (t) => {
          await documentRepo.insert(t, dbContext.pgp, batch);
        });

        genericLogger.info(
          `Staging data inserted for batch of documents: ${batch
            .map((doc) => doc.id)
            .join(", ")}`
        );
      }

      await dbContext.conn.tx(async (t) => {
        await documentRepo.merge(t);
      });

      genericLogger.info(
        `Staging data merged into target tables for all document batches`
      );

      await documentRepo.clean();
    },

    async deleteBatchEService(
      eserviceIds: string[],
      dbContext: DBContext
    ): Promise<void> {
      await dbContext.conn.tx(async (t) => {
        for (const batch of batchMessages(
          eserviceIds,
          config.dbMessagesToInsertPerBatch
        )) {
          await eserviceRepo.insertDeleting(t, dbContext.pgp, batch);

          genericLogger.info(
            `Staging deletion inserted for eserviceIds: ${batch.join(", ")}`
          );
        }
      });

      await dbContext.conn.tx(async (t) => {
        await eserviceRepo.mergeDeleting(t);
        await mergeDeletingCascadeById(
          t,
          "eservice_id",
          [
            CatalogDbTable.eservice_descriptor,
            CatalogDbTable.eservice_descriptor_attribute,
            CatalogDbTable.eservice_descriptor_document,
            CatalogDbTable.eservice_descriptor_interface,
            CatalogDbTable.eservice_descriptor_rejection_reason,
            CatalogDbTable.eservice_descriptor_template_version_ref,
            CatalogDbTable.eservice_risk_analysis,
            CatalogDbTable.eservice_risk_analysis_answer,
          ],
          DeletingDbTable.catalog_deleting_table
        );
      });

      genericLogger.info(
        `Staging deletion merged into target tables for all eserviceIds`
      );

      await eserviceRepo.cleanDeleting();

      genericLogger.info(`Staging catalog table cleaned`);
    },

    async deleteBatchDescriptor(
      descriptorIds: string[],
      dbContext: DBContext
    ): Promise<void> {
      await dbContext.conn.tx(async (t) => {
        for (const batch of batchMessages(
          descriptorIds,
          config.dbMessagesToInsertPerBatch
        )) {
          await descriptorRepo.insertDeleting(t, dbContext.pgp, batch);
          genericLogger.info(
            `Staging deletion inserted for descriptorIds: ${batch.join(", ")}`
          );
        }
      });

      await dbContext.conn.tx(async (t) => {
        await descriptorRepo.mergeDeleting(t);
        await mergeDeletingCascadeById(
          t,
          "descriptor_id",
          [
            CatalogDbTable.eservice_descriptor_attribute,
            CatalogDbTable.eservice_descriptor_document,
            CatalogDbTable.eservice_descriptor_interface,
            CatalogDbTable.eservice_descriptor_rejection_reason,
            CatalogDbTable.eservice_descriptor_template_version_ref,
          ],
          DeletingDbTable.catalog_deleting_table
        );
      });
      genericLogger.info(
        `Staging deletion merged into target tables for all descriptorIds`
      );
      await descriptorRepo.cleanDeleting();

      genericLogger.info(`Staging deleting tables cleaned`);
    },

    async deleteBatchEserviceRiskAnalysis(
      riskAnalysisIds: string[],
      dbContext: DBContext
    ): Promise<void> {
      await dbContext.conn.tx(async (t) => {
        for (const batch of batchMessages(
          riskAnalysisIds,
          config.dbMessagesToInsertPerBatch
        )) {
          await riskAnalysisRepo.insertDeleting(t, dbContext.pgp, batch);
          genericLogger.info(
            `Staging deletion inserted for riskAnalysisIds: ${batch.join(", ")}`
          );
        }
      });
      await dbContext.conn.tx(async (t) => {
        await riskAnalysisRepo.mergeDeleting(t);
      });

      genericLogger.info(
        `Staging deletion merged into target tables for all riskAnalysisIds`
      );

      await riskAnalysisRepo.cleanDeleting();

      genericLogger.info(`Staging deleting tables cleaned`);
    },

    async deleteBatchEServiceDocument(
      documentIds: string[],
      dbContext: DBContext
    ): Promise<void> {
      await dbContext.conn.tx(async (t) => {
        for (const batch of batchMessages(
          documentIds,
          config.dbMessagesToInsertPerBatch
        )) {
          await documentRepo.insertDeleting(t, dbContext.pgp, batch);
          genericLogger.info(
            `Staging deletion inserted for documentIds: ${batch.join(", ")}`
          );
        }
      });

      await dbContext.conn.tx(async (t) => {
        await documentRepo.mergeDeleting(t);
      });
      genericLogger.info(
        `Staging deletion merged into target tables for all documentIds`
      );
      await documentRepo.cleanDeleting();

      genericLogger.info(`Staging deleting tables cleaned`);
    },

    async deleteBatchEserviceInterface(
      descriptorIds: string[],
      dbContext: DBContext
    ): Promise<void> {
      await dbContext.conn.tx(async (t) => {
        for (const batch of batchMessages(
          descriptorIds,
          config.dbMessagesToInsertPerBatch
        )) {
          await interfaceRepo.insertDeleting(t, dbContext.pgp, batch);
          genericLogger.info(
            `Staging deletion inserted for interface descriptorIds: ${batch.join(
              ", "
            )}`
          );
        }
      });

      await dbContext.conn.tx(async (t) => {
        await interfaceRepo.mergeDeleting(t);
      });

      genericLogger.info(
        `Staging deletion merged into target tables for all interface descriptorIds`
      );
      await interfaceRepo.cleanDeleting();

      genericLogger.info(`Staging deleting tables cleaned`);
    },
  };
}
export type CatalogService = ReturnType<typeof catalogServiceBuilder>;
