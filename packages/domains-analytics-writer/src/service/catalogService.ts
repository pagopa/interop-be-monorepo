/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable functional/immutable-data */
/* eslint-disable sonarjs/cognitive-complexity */
import { genericLogger } from "pagopa-interop-commons";
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
import { CatalogDbTable, DeletingDbTable } from "../model/db/index.js";
import { batchMessages } from "../utils/batchHelper.js";
import {
  cleaningTargetTables,
  mergeDeletingCascadeById,
} from "../utils/sqlQueryHelper.js";
import { config } from "../config/config.js";
import {
  EserviceDeletingSchema,
  EserviceItemsSchema,
} from "../model/catalog/eservice.js";
import {
  EserviceDescriptorServerUrlsSchema,
  EserviceDescriptorDeletingSchema,
  EserviceDescriptorItemsSchema,
} from "../model/catalog/eserviceDescriptor.js";
import {
  EserviceDescriptorDocumentDeletingSchema,
  EserviceDescriptorDocumentSchema,
} from "../model/catalog/eserviceDescriptorDocument.js";
import {
  EserviceDescriptorDocumentOrInterfaceDeletingSchema,
  EserviceDescriptorInterfaceSchema,
} from "../model/catalog/eserviceDescriptorInterface.js";

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
    async upsertBatchEService(
      dbContext: DBContext,
      items: EserviceItemsSchema[]
    ) {
      await dbContext.conn.tx(async (t) => {
        for (const batch of batchMessages(
          items,
          config.dbMessagesToInsertPerBatch
        )) {
          const batchItems = {
            eserviceSQL: batch.map((item) => item.eserviceSQL),
            descriptorsSQL: batch.flatMap((item) => item.descriptorsSQL),
            interfacesSQL: batch.flatMap((item) => item.interfacesSQL),
            documentsSQL: batch.flatMap((item) => item.documentsSQL),
            attributesSQL: batch.flatMap((item) => item.attributesSQL),
            riskAnalysesSQL: batch.flatMap((item) => item.riskAnalysesSQL),
            riskAnalysisAnswersSQL: batch.flatMap(
              (item) => item.riskAnalysisAnswersSQL
            ),
            rejectionReasonsSQL: batch.flatMap(
              (item) => item.rejectionReasonsSQL
            ),
            templateVersionRefsSQL: batch.flatMap(
              (item) => item.templateVersionRefsSQL
            ),
          };
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

          genericLogger.info(
            `Staging data inserted for Eservice batch: ${batch
              .map((item) => item.eserviceSQL.id)
              .join(", ")}`
          );
        }

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

      await dbContext.conn.tx(async (t) => {
        await cleaningTargetTables(
          t,
          "eserviceId",
          [
            CatalogDbTable.eservice_descriptor_template_version_ref,
            CatalogDbTable.eservice_descriptor_rejection_reason,
            CatalogDbTable.eservice_descriptor_interface,
            CatalogDbTable.eservice_descriptor_document,
            CatalogDbTable.eservice_descriptor_attribute,
            CatalogDbTable.eservice_risk_analysis_answer,
            CatalogDbTable.eservice_risk_analysis,
            CatalogDbTable.eservice_descriptor,
          ],
          CatalogDbTable.eservice
        );
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

    async upsertBatchEServiceDescriptor(
      dbContext: DBContext,
      items: EserviceDescriptorItemsSchema[]
    ): Promise<void> {
      await dbContext.conn.tx(async (t) => {
        for (const batch of batchMessages(
          items,
          config.dbMessagesToInsertPerBatch
        )) {
          const batchItems = {
            descriptorSQL: batch.map((item) => item.descriptorSQL),
            attributesSQL: batch.flatMap((item) => item.attributesSQL),
            interfaceSQL: batch.flatMap((item) =>
              item.interfaceSQL ? [item.interfaceSQL] : []
            ),
            documentsSQL: batch.flatMap((item) => item.documentsSQL),
            rejectionReasonsSQL: batch.flatMap(
              (item) => item.rejectionReasonsSQL
            ),
            templateVersionRefSQL: batch.flatMap((item) =>
              item.templateVersionRefSQL ? [item.templateVersionRefSQL] : []
            ),
          };

          if (batchItems.descriptorSQL.length > 0) {
            await descriptorRepo.insert(
              t,
              dbContext.pgp,
              batchItems.descriptorSQL
            );
          }

          if (batchItems.attributesSQL.length > 0) {
            await attributeRepo.insert(
              t,
              dbContext.pgp,
              batchItems.attributesSQL
            );
          }

          if (batchItems.interfaceSQL.length > 0) {
            await interfaceRepo.insert(
              t,
              dbContext.pgp,
              batchItems.interfaceSQL
            );
          }

          if (batchItems.documentsSQL.length > 0) {
            await documentRepo.insert(
              t,
              dbContext.pgp,
              batchItems.documentsSQL
            );
          }

          if (batchItems.rejectionReasonsSQL.length > 0) {
            await rejectionRepo.insert(
              t,
              dbContext.pgp,
              batchItems.rejectionReasonsSQL
            );
          }

          if (batchItems.templateVersionRefSQL.length > 0) {
            await templateVersionRefRepo.insert(
              t,
              dbContext.pgp,
              batchItems.templateVersionRefSQL
            );
          }

          genericLogger.info(
            `Staging data inserted for EserviceDescriptor batch: ${batch
              .map((item) => item.descriptorSQL.id)
              .join(", ")}`
          );
        }

        await descriptorRepo.merge(t);
        await attributeRepo.merge(t);
        await interfaceRepo.merge(t);
        await documentRepo.merge(t);
        await rejectionRepo.merge(t);
        await templateVersionRefRepo.merge(t);

        await dbContext.conn.tx(async (t) => {
          await cleaningTargetTables(
            t,
            "descriptorId",
            [
              CatalogDbTable.eservice_descriptor_template_version_ref,
              CatalogDbTable.eservice_descriptor_rejection_reason,
              CatalogDbTable.eservice_descriptor_interface,
              CatalogDbTable.eservice_descriptor_document,
              CatalogDbTable.eservice_descriptor_attribute,
            ],
            CatalogDbTable.eservice_descriptor
          );
        });
      });

      genericLogger.info(
        "Staging data merged into target tables for EserviceDescriptor batches"
      );

      await descriptorRepo.clean();
      await attributeRepo.clean();
      await interfaceRepo.clean();
      await documentRepo.clean();
      await rejectionRepo.clean();
      await templateVersionRefRepo.clean();
    },

    async upsertBatchEServiceDocument(
      dbContext: DBContext,
      items: EserviceDescriptorDocumentSchema[]
    ): Promise<void> {
      await dbContext.conn.tx(async (t) => {
        for (const batch of batchMessages(
          items,
          config.dbMessagesToInsertPerBatch
        )) {
          await documentRepo.insert(t, dbContext.pgp, batch);

          genericLogger.info(
            `Staging data inserted for EserviceDescriptorDocument batch: ${batch
              .map((doc) => doc.id)
              .join(", ")}`
          );
        }

        await documentRepo.merge(t);

        await dbContext.conn.tx(async (t) => {
          await cleaningTargetTables(
            t,
            "id",
            [CatalogDbTable.eservice_descriptor_document],
            CatalogDbTable.eservice_descriptor_document
          );
        });
      });

      genericLogger.info(
        `Staging data merged into target tables for EserviceDescriptorDocument batches`
      );

      await documentRepo.clean();
    },

    async upsertBatchEserviceDescriptorInterface(
      dbContext: DBContext,
      items: EserviceDescriptorInterfaceSchema[]
    ): Promise<void> {
      await dbContext.conn.tx(async (t) => {
        for (const batch of batchMessages(
          items,
          config.dbMessagesToInsertPerBatch
        )) {
          await interfaceRepo.insert(t, dbContext.pgp, batch);

          genericLogger.info(
            `Staging data inserted for EserviceDescriptorDocument batch: ${batch
              .map((doc) => doc.id)
              .join(", ")}`
          );
        }

        await interfaceRepo.merge(t);
      });

      genericLogger.info(
        `Staging data merged into target tables for EserviceDescriptorDocument batches`
      );

      await interfaceRepo.clean();
    },
    async upsertBatchDescriptorServerUrls(
      dbContext: DBContext,
      items: EserviceDescriptorServerUrlsSchema[]
    ): Promise<void> {
      await dbContext.conn.tx(async (t) => {
        for (const batch of batchMessages(
          items,
          config.dbMessagesToInsertPerBatch
        )) {
          await descriptorRepo.insertServerUrls(t, dbContext.pgp, batch);

          genericLogger.info(
            `Staging data inserted for for server urls to update, batch: ${batch
              .map((doc) => doc.id)
              .join(", ")}`
          );
        }

        await descriptorRepo.mergeServerUrls(t);
      });

      genericLogger.info(
        `Staging data merged into target tables for server urls to update, batches`
      );

      await descriptorRepo.cleanServerUrls();
    },

    async deleteBatchEService(
      dbContext: DBContext,
      items: EserviceDeletingSchema[]
    ): Promise<void> {
      await dbContext.conn.tx(async (t) => {
        for (const batch of batchMessages(
          items,
          config.dbMessagesToInsertPerBatch
        )) {
          await eserviceRepo.insertDeleting(t, dbContext.pgp, batch);
          genericLogger.info(
            `Staging deletion inserted for Eservice ids: ${batch
              .map((item) => item.id)
              .join(", ")}`
          );
        }

        await eserviceRepo.mergeDeleting(t);
        await mergeDeletingCascadeById(
          t,
          "eserviceId",
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
        `Staging deletion merged into target tables for Eservice`
      );
      await eserviceRepo.cleanDeleting();
      genericLogger.info(`Staging catalog table cleaned`);
    },

    async deleteBatchDescriptor(
      dbContext: DBContext,
      items: EserviceDescriptorDeletingSchema[]
    ): Promise<void> {
      await dbContext.conn.tx(async (t) => {
        for (const batch of batchMessages(
          items,
          config.dbMessagesToInsertPerBatch
        )) {
          await descriptorRepo.insertDeleting(t, dbContext.pgp, batch);
          genericLogger.info(
            `Staging deletion inserted for EserviceDescriptor ids: ${batch
              .map((item) => item.id)
              .join(", ")}`
          );
        }

        await mergeDeletingCascadeById(
          t,
          "descriptorId",
          [
            CatalogDbTable.eservice_descriptor_attribute,
            CatalogDbTable.eservice_descriptor_document,
            CatalogDbTable.eservice_descriptor_interface,
            CatalogDbTable.eservice_descriptor_rejection_reason,
            CatalogDbTable.eservice_descriptor_template_version_ref,
          ],
          DeletingDbTable.catalog_deleting_table,
          true
        );
        await descriptorRepo.mergeDeleting(t);
      });
      genericLogger.info(
        `Staging deletion merged into target tables for EserviceDescriptor ids`
      );
      await descriptorRepo.cleanDeleting();
      genericLogger.info(
        `Staging deleting tables cleaned for EserviceDescriptor`
      );
    },

    async deleteBatchEServiceDocument(
      dbContext: DBContext,
      items: EserviceDescriptorDocumentDeletingSchema[]
    ): Promise<void> {
      await dbContext.conn.tx(async (t) => {
        for (const batch of batchMessages(
          items,
          config.dbMessagesToInsertPerBatch
        )) {
          await documentRepo.insertDeleting(t, dbContext.pgp, batch);
          genericLogger.info(
            `Staging deletion inserted for EserviceDescriptorDocument ids: ${batch
              .map((item) => item.id)
              .join(", ")}`
          );
        }

        await documentRepo.mergeDeleting(t);
      });

      genericLogger.info(
        `Staging deletion merged into target tables for EserviceDescriptorDocument`
      );

      await documentRepo.cleanDeleting();

      genericLogger.info(
        `Staging deleting tables cleaned for EserviceDescriptorDocument`
      );
    },

    async deleteDescriptorDocumentOrInterfaceBatch(
      dbContext: DBContext,
      items: EserviceDescriptorDocumentOrInterfaceDeletingSchema[]
    ): Promise<void> {
      await dbContext.conn.tx(async (t) => {
        for (const batch of batchMessages(
          items,
          config.dbMessagesToInsertPerBatch
        )) {
          await interfaceRepo.insertDeleting(t, dbContext.pgp, batch);
          genericLogger.info(
            `Staging deletion inserted for EserviceDescriptorInterface ids: ${batch
              .map((item) => item.id)
              .join(", ")}`
          );
        }
        const idsToDelete = items.map((item) => item.id);
        const interfaceIdsDeleted = await interfaceRepo.mergeDeleting(
          t,
          idsToDelete
        );

        const interfaceItems = items.filter((i) =>
          interfaceIdsDeleted.includes(i.id)
        );

        const documentItems = items.filter(
          (i) => !interfaceIdsDeleted.includes(i.id)
        );

        if (interfaceItems.length > 0) {
          const serverUrlsToUpdate = interfaceItems.map((item) => ({
            id: item.descriptorId,
            serverUrls: JSON.stringify([]),
            metadataVersion: item.metadataVersion,
          }));

          await descriptorRepo.insertServerUrls(
            t,
            dbContext.pgp,
            serverUrlsToUpdate
          );
          genericLogger.info(
            `Staging data inserted for server urls to update, descriptorIds: ${serverUrlsToUpdate
              .map((descriptor) => descriptor.id)
              .join(", ")}`
          );
          await descriptorRepo.mergeServerUrls(t);

          await descriptorRepo.cleanServerUrls();

          await interfaceRepo.cleanDeleting();

          genericLogger.info(
            `Staging deleting tables cleaned for EserviceDescriptorInterface`
          );
        }

        if (documentItems.length > 0) {
          for (const batch of batchMessages(
            documentItems,
            config.dbMessagesToInsertPerBatch
          )) {
            await documentRepo.insertDeleting(t, dbContext.pgp, batch);
            genericLogger.info(
              `Staging deletion inserted for EserviceDescriptorDocument ids: ${batch
                .map((item) => item.id)
                .join(", ")}`
            );
          }

          await documentRepo.mergeDeleting(t);

          genericLogger.info(
            `Staging deletion merged into target tables for EserviceDescriptorDocument`
          );

          await documentRepo.cleanDeleting();

          genericLogger.info(
            `Staging deleting tables cleaned for EserviceDescriptorDocument`
          );
        }
      });
    },
  };
}
