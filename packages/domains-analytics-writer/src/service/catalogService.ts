/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { EService } from "pagopa-interop-models";
import { splitEserviceIntoObjectsSQL } from "pagopa-interop-readmodel";
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
import { eserviceTemplateRefRepository } from "../repository/catalog/eserviceTemplateRef.repository.js";
import { eserviceRepository } from "../repository/catalog/eservice.repository.js";

export function catalogServiceBuilder(db: DBContext) {
  const eserviceRepo = eserviceRepository(db.conn);
  const templateRefRepo = eserviceTemplateRefRepository(db.conn);
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
    async upsertEService(
      eservice: EService,
      metadataVersion: number
    ): Promise<void> {
      const {
        eserviceSQL,
        descriptorsSQL,
        interfacesSQL,
        documentsSQL,
        attributesSQL,
        riskAnalysesSQL,
        riskAnalysisAnswersSQL,
        rejectionReasonsSQL,
        templateRefSQL,
        templateVersionRefsSQL,
      } = splitEserviceIntoObjectsSQL(eservice, metadataVersion);

      await db.conn.tx(async (t) => {
        await eserviceRepo.insert(t, db.pgp, eserviceSQL);
        await eserviceRepo.merge(t);

        if (descriptorsSQL.length > 0) {
          await descriptorRepo.insert(t, db.pgp, descriptorsSQL);
          await descriptorRepo.merge(t);
        }

        if (interfacesSQL.length > 0) {
          await interfaceRepo.insert(t, db.pgp, interfacesSQL);
          await interfaceRepo.merge(t);
        }

        if (documentsSQL.length > 0) {
          await documentRepo.insert(t, db.pgp, documentsSQL);
          await documentRepo.merge(t);
        }

        if (attributesSQL.length > 0) {
          await attributeRepo.insert(t, db.pgp, attributesSQL);
          await attributeRepo.merge(t);
        }

        if (riskAnalysesSQL.length > 0) {
          await riskAnalysisRepo.insert(t, db.pgp, riskAnalysesSQL);
          await riskAnalysisRepo.merge(t);
        }

        if (riskAnalysisAnswersSQL.length > 0) {
          await riskAnalysisAnswerRepo.insert(
            t,
            db.pgp,
            riskAnalysisAnswersSQL
          );
          await riskAnalysisAnswerRepo.merge(t);
        }
        if (rejectionReasonsSQL.length > 0) {
          await rejectionRepo.insert(t, db.pgp, rejectionReasonsSQL);
          await rejectionRepo.merge(t);
        }

        if (templateRefSQL) {
          await templateRefRepo.insert(t, db.pgp, [templateRefSQL]);
          await templateRefRepo.merge(t);
        }

        if (templateVersionRefsSQL.length > 0) {
          await templateVersionRefRepo.insert(
            t,
            db.pgp,
            templateVersionRefsSQL
          );
          await templateVersionRefRepo.merge(t);
        }

        genericLogger.info(
          `Staging records insertion completed for eserviceId: ${eserviceSQL.id}`
        );
      });

      genericLogger.info(
        `Staging data merged into target tables for eserviceId: ${eserviceSQL.id}`
      );

      await eserviceRepo.clean();
      await templateRefRepo.clean();
      await descriptorRepo.clean();
      await interfaceRepo.clean();
      await documentRepo.clean();
      await attributeRepo.clean();
      await riskAnalysisRepo.clean();
      await riskAnalysisAnswerRepo.clean();
      await rejectionRepo.clean();
      await templateVersionRefRepo.clean();

      genericLogger.info(
        `Staging cleanup completed for eserviceId: ${eserviceSQL.id}`
      );
    },

    async deleteEService(eserviceId: string): Promise<void> {
      await db.conn.tx(async (t) => {
        await eserviceRepo.deleteEservice(t, db.pgp, eserviceId);
        await eserviceRepo.mergeDeleting(t);
      });
      await eserviceRepo.cleanDeleting();
    },

    async upsertEServiceDescriptor(descriptorData: any): Promise<void> {
      await db.conn.tx(async (t) => {
        await descriptorRepo.insert(t, db.pgp, [descriptorData]);
        await descriptorRepo.merge(t);
      });
      await descriptorRepo.clean();
    },

    async deleteDescriptor(descriptorId: string): Promise<void> {
      await db.conn.tx(async (t) => {
        await descriptorRepo.deleteDescriptor(t, db.pgp, descriptorId);
        await descriptorRepo.mergeDeleting(t);
      });
      await descriptorRepo.cleanDeleting();
    },

    async upsertEServiceDocument(documentData: any): Promise<void> {
      await db.conn.tx(async (t) => {
        await documentRepo.insert(t, db.pgp, documentData);
      });
      await documentRepo.clean();
    },

    async deleteEServiceDocument(documentId: string): Promise<void> {
      await db.conn.tx(async (t) => {
        await documentRepo.deleteDocument(t, db.pgp, documentId);
        await documentRepo.mergeDeleting(t);
      });
      await documentRepo.cleanDeleting();
    },

    async deleteEserviceRiskAnalysis(riskAnalysisId: string): Promise<void> {
      await db.conn.tx(async (t) => {
        await riskAnalysisRepo.deleteRiskAnalysis(t, db.pgp, riskAnalysisId);
        await riskAnalysisRepo.mergeDeleting(t);
      });
      await riskAnalysisRepo.cleanDeleting();
    },
  };
}
export type CatalogService = ReturnType<typeof catalogServiceBuilder>;
