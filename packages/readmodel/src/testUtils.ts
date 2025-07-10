import { eq } from "drizzle-orm";
import { Agreement, Attribute, EService } from "pagopa-interop-models";
import {
  agreementInReadmodelAgreement,
  agreementStampInReadmodelAgreement,
  agreementAttributeInReadmodelAgreement,
  agreementConsumerDocumentInReadmodelAgreement,
  agreementContractInReadmodelAgreement,
  DrizzleReturnType,
  attributeInReadmodelAttribute,
  eserviceDescriptorAttributeInReadmodelCatalog,
  eserviceDescriptorDocumentInReadmodelCatalog,
  eserviceDescriptorInReadmodelCatalog,
  eserviceDescriptorInterfaceInReadmodelCatalog,
  eserviceDescriptorRejectionReasonInReadmodelCatalog,
  eserviceDescriptorTemplateVersionRefInReadmodelCatalog,
  eserviceInReadmodelCatalog,
  eserviceRiskAnalysisAnswerInReadmodelCatalog,
  eserviceRiskAnalysisInReadmodelCatalog,
} from "pagopa-interop-readmodel-models";
import { splitAgreementIntoObjectsSQL } from "./agreement/splitters.js";
import { checkMetadataVersion } from "./utils.js";
import { splitAttributeIntoObjectsSQL } from "./attribute/splitters.js";
import { splitEserviceIntoObjectsSQL } from "./catalog/splitters.js";

// TODO: simplify the functions for tests. Maybe rename to insertX to keep it aligned with the notifications functions
export const upsertAgreement = async (
  readModelDB: DrizzleReturnType,
  agreement: Agreement,
  metadataVersion: number
): Promise<void> => {
  const {
    agreementSQL,
    stampsSQL,
    attributesSQL,
    consumerDocumentsSQL,
    contractSQL,
  } = splitAgreementIntoObjectsSQL(agreement, metadataVersion);

  await readModelDB.transaction(async (tx) => {
    const shouldUpsert = await checkMetadataVersion(
      tx,
      agreementInReadmodelAgreement,
      metadataVersion,
      agreement.id
    );

    if (!shouldUpsert) {
      return;
    }

    await tx
      .delete(agreementInReadmodelAgreement)
      .where(eq(agreementInReadmodelAgreement.id, agreement.id));

    await tx.insert(agreementInReadmodelAgreement).values(agreementSQL);

    for (const stampSQL of stampsSQL) {
      await tx.insert(agreementStampInReadmodelAgreement).values(stampSQL);
    }

    for (const attributeSQL of attributesSQL) {
      await tx
        .insert(agreementAttributeInReadmodelAgreement)
        .values(attributeSQL);
    }

    for (const docSQL of consumerDocumentsSQL) {
      await tx
        .insert(agreementConsumerDocumentInReadmodelAgreement)
        .values(docSQL);
    }
    if (contractSQL !== undefined) {
      await tx
        .insert(agreementContractInReadmodelAgreement)
        .values(contractSQL);
    }
  });
};

export const upsertAttribute = async (
  readModelDB: DrizzleReturnType,
  attribute: Attribute,
  metadataVersion: number
): Promise<void> => {
  await readModelDB.transaction(async (tx) => {
    const shouldUpsert = await checkMetadataVersion(
      tx,
      attributeInReadmodelAttribute,
      metadataVersion,
      attribute.id
    );

    if (!shouldUpsert) {
      return;
    }

    await tx
      .delete(attributeInReadmodelAttribute)
      .where(eq(attributeInReadmodelAttribute.id, attribute.id));

    const attributeSQL = splitAttributeIntoObjectsSQL(
      attribute,
      metadataVersion
    );

    await tx.insert(attributeInReadmodelAttribute).values(attributeSQL);
  });
};

export const upsertEService = async (
  readModelDB: DrizzleReturnType,
  eservice: EService,
  metadataVersion: number
): Promise<void> => {
  await readModelDB.transaction(async (tx) => {
    const shouldUpsert = await checkMetadataVersion(
      tx,
      eserviceInReadmodelCatalog,
      metadataVersion,
      eservice.id
    );

    if (!shouldUpsert) {
      return;
    }

    await tx
      .delete(eserviceInReadmodelCatalog)
      .where(eq(eserviceInReadmodelCatalog.id, eservice.id));

    const {
      eserviceSQL,
      riskAnalysesSQL,
      riskAnalysisAnswersSQL,
      descriptorsSQL,
      attributesSQL,
      interfacesSQL,
      documentsSQL,
      rejectionReasonsSQL,
      templateVersionRefsSQL,
    } = splitEserviceIntoObjectsSQL(eservice, metadataVersion);

    await tx.insert(eserviceInReadmodelCatalog).values(eserviceSQL);

    for (const descriptorSQL of descriptorsSQL) {
      await tx
        .insert(eserviceDescriptorInReadmodelCatalog)
        .values(descriptorSQL);
    }

    for (const interfaceSQL of interfacesSQL) {
      await tx
        .insert(eserviceDescriptorInterfaceInReadmodelCatalog)
        .values(interfaceSQL);
    }

    for (const docSQL of documentsSQL) {
      await tx
        .insert(eserviceDescriptorDocumentInReadmodelCatalog)
        .values(docSQL);
    }

    for (const attributeSQL of attributesSQL) {
      await tx
        .insert(eserviceDescriptorAttributeInReadmodelCatalog)
        .values(attributeSQL);
    }

    for (const riskAnalysisSQL of riskAnalysesSQL) {
      await tx
        .insert(eserviceRiskAnalysisInReadmodelCatalog)
        .values(riskAnalysisSQL);
    }

    for (const riskAnalysisAnswerSQL of riskAnalysisAnswersSQL) {
      await tx
        .insert(eserviceRiskAnalysisAnswerInReadmodelCatalog)
        .values(riskAnalysisAnswerSQL);
    }

    for (const rejectionReasonSQL of rejectionReasonsSQL) {
      await tx
        .insert(eserviceDescriptorRejectionReasonInReadmodelCatalog)
        .values(rejectionReasonSQL);
    }

    for (const templateVersionRefSQL of templateVersionRefsSQL) {
      await tx
        .insert(eserviceDescriptorTemplateVersionRefInReadmodelCatalog)
        .values(templateVersionRefSQL);
    }
  });
};
