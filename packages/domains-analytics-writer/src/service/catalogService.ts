/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { EService } from "pagopa-interop-models";
import { splitEserviceIntoObjectsSQL } from "pagopa-interop-readmodel";
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
        if (templateRefSQL) {
          await templateRefRepo.insert(t, db.pgp, [templateRefSQL]);
        }
        await descriptorRepo.insert(t, db.pgp, descriptorsSQL);
        await interfaceRepo.insert(t, db.pgp, interfacesSQL);
        await documentRepo.insert(t, db.pgp, documentsSQL);
        await attributeRepo.insert(t, db.pgp, attributesSQL);
        await riskAnalysisRepo.insert(t, db.pgp, riskAnalysesSQL);
        await riskAnalysisAnswerRepo.insert(t, db.pgp, riskAnalysisAnswersSQL);
        await rejectionRepo.insert(t, db.pgp, rejectionReasonsSQL);
        await templateVersionRefRepo.insert(t, db.pgp, templateVersionRefsSQL);

        await eserviceRepo.merge(t);
        await templateRefRepo.merge(t);
        await descriptorRepo.merge(t);
        await interfaceRepo.merge(t);
        await documentRepo.merge(t);
        await attributeRepo.merge(t);
        await riskAnalysisRepo.merge(t);
        await riskAnalysisAnswerRepo.merge(t);
        await rejectionRepo.merge(t);
        await templateVersionRefRepo.merge(t);
      });

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
    },
  };
}
export type CatalogService = ReturnType<typeof catalogServiceBuilder>;
