import {
  Agreement,
  EServiceTemplate,
  TenantNotificationConfig,
  UserNotificationConfig,
} from "pagopa-interop-models";
import {
  agreementAttributeInReadmodelAgreement,
  agreementConsumerDocumentInReadmodelAgreement,
  agreementContractInReadmodelAgreement,
  agreementInReadmodelAgreement,
  agreementStampInReadmodelAgreement,
  DrizzleReturnType,
  eserviceTemplateInReadmodelEserviceTemplate,
  eserviceTemplateRiskAnalysisAnswerInReadmodelEserviceTemplate,
  eserviceTemplateRiskAnalysisInReadmodelEserviceTemplate,
  eserviceTemplateVersionAttributeInReadmodelEserviceTemplate,
  eserviceTemplateVersionDocumentInReadmodelEserviceTemplate,
  eserviceTemplateVersionInReadmodelEserviceTemplate,
  eserviceTemplateVersionInterfaceInReadmodelEserviceTemplate,
  tenantNotificationConfigInReadmodelNotificationConfig,
  userNotificationConfigInReadmodelNotificationConfig,
} from "pagopa-interop-readmodel-models";
import { eq } from "drizzle-orm";
import {
  splitTenantNotificationConfigIntoObjectsSQL,
  splitUserNotificationConfigIntoObjectsSQL,
} from "./notification-config/splitters.js";
import { splitAgreementIntoObjectsSQL } from "./agreement/splitters.js";
import { checkMetadataVersion } from "./utils.js";
import { splitEServiceTemplateIntoObjectsSQL } from "./eservice-template/splitters.js";

export const insertTenantNotificationConfig = async (
  readModelDB: DrizzleReturnType,
  tenantNotificationConfig: TenantNotificationConfig,
  metadataVersion: number
): Promise<void> => {
  await readModelDB
    .insert(tenantNotificationConfigInReadmodelNotificationConfig)
    .values(
      splitTenantNotificationConfigIntoObjectsSQL(
        tenantNotificationConfig,
        metadataVersion
      )
    );
};

export const insertUserNotificationConfig = async (
  readModelDB: DrizzleReturnType,
  userNotificationConfig: UserNotificationConfig,
  metadataVersion: number
): Promise<void> => {
  await readModelDB
    .insert(userNotificationConfigInReadmodelNotificationConfig)
    .values(
      splitUserNotificationConfigIntoObjectsSQL(
        userNotificationConfig,
        metadataVersion
      )
    );
};

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

export const upsertEServiceTemplate = async (
  readModelDB: DrizzleReturnType,
  eserviceTemplate: EServiceTemplate,
  metadataVersion: number
): Promise<void> => {
  await readModelDB.transaction(async (tx) => {
    const shouldUpsert = await checkMetadataVersion(
      tx,
      eserviceTemplateInReadmodelEserviceTemplate,
      metadataVersion,
      eserviceTemplate.id
    );

    if (!shouldUpsert) {
      return;
    }

    await tx
      .delete(eserviceTemplateInReadmodelEserviceTemplate)
      .where(
        eq(eserviceTemplateInReadmodelEserviceTemplate.id, eserviceTemplate.id)
      );

    const {
      eserviceTemplateSQL,
      riskAnalysesSQL,
      riskAnalysisAnswersSQL,
      versionsSQL,
      attributesSQL,
      interfacesSQL,
      documentsSQL,
    } = splitEServiceTemplateIntoObjectsSQL(eserviceTemplate, metadataVersion);

    await tx
      .insert(eserviceTemplateInReadmodelEserviceTemplate)
      .values(eserviceTemplateSQL);

    for (const versionSQL of versionsSQL) {
      await tx
        .insert(eserviceTemplateVersionInReadmodelEserviceTemplate)
        .values(versionSQL);
    }

    for (const interfaceSQL of interfacesSQL) {
      await tx
        .insert(eserviceTemplateVersionInterfaceInReadmodelEserviceTemplate)
        .values(interfaceSQL);
    }

    for (const docSQL of documentsSQL) {
      await tx
        .insert(eserviceTemplateVersionDocumentInReadmodelEserviceTemplate)
        .values(docSQL);
    }

    for (const attributeSQL of attributesSQL) {
      await tx
        .insert(eserviceTemplateVersionAttributeInReadmodelEserviceTemplate)
        .values(attributeSQL);
    }

    for (const riskAnalysisSQL of riskAnalysesSQL) {
      await tx
        .insert(eserviceTemplateRiskAnalysisInReadmodelEserviceTemplate)
        .values(riskAnalysisSQL);
    }

    for (const riskAnalysisAnswerSQL of riskAnalysisAnswersSQL) {
      await tx
        .insert(eserviceTemplateRiskAnalysisAnswerInReadmodelEserviceTemplate)
        .values(riskAnalysisAnswerSQL);
    }
  });
};
