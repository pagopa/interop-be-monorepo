import {
  Agreement,
  Attribute,
  Client,
  ClientJWKKey,
  Delegation,
  EService,
  EServiceDescriptorPurposeTemplate,
  EServiceTemplate,
  ProducerJWKKey,
  ProducerKeychain,
  Purpose,
  PurposeTemplate,
  PurposeTemplateId,
  Tenant,
  TenantNotificationConfig,
  UserNotificationConfig,
} from "pagopa-interop-models";
import {
  agreementAttributeInReadmodelAgreement,
  agreementConsumerDocumentInReadmodelAgreement,
  agreementContractInReadmodelAgreement,
  agreementInReadmodelAgreement,
  agreementStampInReadmodelAgreement,
  attributeInReadmodelAttribute,
  clientJwkKeyInReadmodelClientJwkKey,
  DrizzleReturnType,
  eserviceDescriptorAttributeInReadmodelCatalog,
  eserviceDescriptorDocumentInReadmodelCatalog,
  eserviceDescriptorInReadmodelCatalog,
  eserviceDescriptorInterfaceInReadmodelCatalog,
  eserviceDescriptorRejectionReasonInReadmodelCatalog,
  eserviceDescriptorTemplateVersionRefInReadmodelCatalog,
  eserviceInReadmodelCatalog,
  eserviceRiskAnalysisAnswerInReadmodelCatalog,
  eserviceRiskAnalysisInReadmodelCatalog,
  tenantNotificationConfigInReadmodelNotificationConfig,
  userEnabledInAppNotificationInReadmodelNotificationConfig,
  userEnabledEmailNotificationInReadmodelNotificationConfig,
  userNotificationConfigInReadmodelNotificationConfig,
  clientInReadmodelClient,
  clientKeyInReadmodelClient,
  clientPurposeInReadmodelClient,
  clientUserInReadmodelClient,
  delegationContractDocumentInReadmodelDelegation,
  delegationInReadmodelDelegation,
  delegationStampInReadmodelDelegation,
  eserviceTemplateInReadmodelEserviceTemplate,
  eserviceTemplateRiskAnalysisAnswerInReadmodelEserviceTemplate,
  eserviceTemplateRiskAnalysisInReadmodelEserviceTemplate,
  eserviceTemplateVersionAttributeInReadmodelEserviceTemplate,
  eserviceTemplateVersionDocumentInReadmodelEserviceTemplate,
  eserviceTemplateVersionInReadmodelEserviceTemplate,
  eserviceTemplateVersionInterfaceInReadmodelEserviceTemplate,
  producerJwkKeyInReadmodelProducerJwkKey,
  producerKeychainEserviceInReadmodelProducerKeychain,
  producerKeychainInReadmodelProducerKeychain,
  producerKeychainKeyInReadmodelProducerKeychain,
  producerKeychainUserInReadmodelProducerKeychain,
  purposeInReadmodelPurpose,
  purposeRiskAnalysisAnswerInReadmodelPurpose,
  purposeRiskAnalysisFormInReadmodelPurpose,
  purposeVersionDocumentInReadmodelPurpose,
  purposeVersionInReadmodelPurpose,
  tenantCertifiedAttributeInReadmodelTenant,
  tenantDeclaredAttributeInReadmodelTenant,
  tenantFeatureInReadmodelTenant,
  tenantInReadmodelTenant,
  tenantMailInReadmodelTenant,
  tenantVerifiedAttributeInReadmodelTenant,
  tenantVerifiedAttributeRevokerInReadmodelTenant,
  tenantVerifiedAttributeVerifierInReadmodelTenant,
  purposeTemplateInReadmodelPurposeTemplate,
  purposeTemplateRiskAnalysisAnswerAnnotationDocumentInReadmodelPurposeTemplate,
  purposeTemplateRiskAnalysisAnswerAnnotationInReadmodelPurposeTemplate,
  purposeTemplateRiskAnalysisAnswerInReadmodelPurposeTemplate,
  purposeTemplateRiskAnalysisFormInReadmodelPurposeTemplate,
  purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate,
  purposeVersionStampInReadmodelPurpose,
  purposeTemplateChildTables,
  DrizzleTransactionType,
  purposeTemplateTables,
} from "pagopa-interop-readmodel-models";
import { and, eq, lte } from "drizzle-orm";
import {
  splitTenantNotificationConfigIntoObjectsSQL,
  splitUserNotificationConfigIntoObjectsSQL,
} from "./notification-config/splitters.js";
import { splitAgreementIntoObjectsSQL } from "./agreement/splitters.js";
import { checkMetadataVersion, checkMetadataVersionByFilter } from "./utils.js";
import { splitAttributeIntoObjectsSQL } from "./attribute/splitters.js";
import { splitEserviceIntoObjectsSQL } from "./catalog/splitters.js";
import { splitClientJWKKeyIntoObjectsSQL } from "./authorization/clientJWKKeySplitters.js";
import { splitClientIntoObjectsSQL } from "./authorization/clientSplitters.js";
import { splitDelegationIntoObjectsSQL } from "./delegation/splitters.js";
import { splitEServiceTemplateIntoObjectsSQL } from "./eservice-template/splitters.js";
import { splitProducerJWKKeyIntoObjectsSQL } from "./authorization/producerJWKKeySplitters.js";
import { splitProducerKeychainIntoObjectsSQL } from "./authorization/producerKeychainSplitters.js";
import { splitPurposeIntoObjectsSQL } from "./purpose/splitters.js";
import { splitTenantIntoObjectsSQL } from "./tenant/splitters.js";
import {
  splitPurposeTemplateIntoObjectsSQL,
  toPurposeTemplateEServiceDescriptorSQL,
} from "./purpose-template/splitters.js";

export const insertTenantNotificationConfig = async (
  readModelDB: DrizzleReturnType,
  tenantNotificationConfig: TenantNotificationConfig,
  metadataVersion: number
): Promise<void> => {
  const tenantNotificationConfigSQL =
    splitTenantNotificationConfigIntoObjectsSQL(
      tenantNotificationConfig,
      metadataVersion
    );

  await readModelDB.transaction(async (tx) => {
    await tx
      .insert(tenantNotificationConfigInReadmodelNotificationConfig)
      .values(tenantNotificationConfigSQL);
  });
};

export const insertUserNotificationConfig = async (
  readModelDB: DrizzleReturnType,
  userNotificationConfig: UserNotificationConfig,
  metadataVersion: number
): Promise<void> => {
  const {
    userNotificationConfigSQL,
    enabledInAppNotificationsSQL,
    enabledEmailNotificationsSQL,
  } = splitUserNotificationConfigIntoObjectsSQL(
    userNotificationConfig,
    metadataVersion
  );

  await readModelDB.transaction(async (tx) => {
    await tx
      .insert(userNotificationConfigInReadmodelNotificationConfig)
      .values(userNotificationConfigSQL);
    if (enabledInAppNotificationsSQL.length > 0) {
      await tx
        .insert(userEnabledInAppNotificationInReadmodelNotificationConfig)
        .values(enabledInAppNotificationsSQL);
    }
    if (enabledEmailNotificationsSQL.length > 0) {
      await tx
        .insert(userEnabledEmailNotificationInReadmodelNotificationConfig)
        .values(enabledEmailNotificationsSQL);
    }
  });
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

export const upsertClientJWKKey = async (
  readModelDB: DrizzleReturnType,
  clientJWKKey: ClientJWKKey,
  metadataVersion: number
): Promise<void> => {
  await readModelDB.transaction(async (tx) => {
    const shouldUpsert = await checkMetadataVersionByFilter(
      tx,
      clientJwkKeyInReadmodelClientJwkKey,
      metadataVersion,
      and(
        eq(clientJwkKeyInReadmodelClientJwkKey.kid, clientJWKKey.kid),
        eq(clientJwkKeyInReadmodelClientJwkKey.clientId, clientJWKKey.clientId)
      )
    );

    if (!shouldUpsert) {
      return;
    }

    await tx
      .delete(clientJwkKeyInReadmodelClientJwkKey)
      .where(
        and(
          eq(
            clientJwkKeyInReadmodelClientJwkKey.clientId,
            clientJWKKey.clientId
          ),
          eq(clientJwkKeyInReadmodelClientJwkKey.kid, clientJWKKey.kid)
        )
      );

    const clientJWKKeySQL = splitClientJWKKeyIntoObjectsSQL(
      clientJWKKey,
      metadataVersion
    );

    await tx
      .insert(clientJwkKeyInReadmodelClientJwkKey)
      .values(clientJWKKeySQL);
  });
};

export const upsertClient = async (
  readModelDB: DrizzleReturnType,
  client: Client,
  metadataVersion: number
): Promise<void> => {
  await readModelDB.transaction(async (tx) => {
    const shouldUpsert = await checkMetadataVersion(
      tx,
      clientInReadmodelClient,
      metadataVersion,
      client.id
    );

    if (!shouldUpsert) {
      return;
    }

    await tx
      .delete(clientInReadmodelClient)
      .where(eq(clientInReadmodelClient.id, client.id));

    const { clientSQL, usersSQL, purposesSQL, keysSQL } =
      splitClientIntoObjectsSQL(client, metadataVersion);

    await tx.insert(clientInReadmodelClient).values(clientSQL);

    for (const userSQL of usersSQL) {
      await tx
        .insert(clientUserInReadmodelClient)
        .values(userSQL)
        .onConflictDoNothing();
    }

    for (const purposeSQL of purposesSQL) {
      await tx.insert(clientPurposeInReadmodelClient).values(purposeSQL);
    }

    for (const keySQL of keysSQL) {
      await tx.insert(clientKeyInReadmodelClient).values(keySQL);
    }
  });
};

export const upsertDelegation = async (
  readModelDB: DrizzleReturnType,
  delegation: Delegation,
  metadataVersion: number
): Promise<void> => {
  await readModelDB.transaction(async (tx) => {
    const shouldUpsert = await checkMetadataVersion(
      tx,
      delegationInReadmodelDelegation,
      metadataVersion,
      delegation.id
    );

    if (!shouldUpsert) {
      return;
    }

    await tx
      .delete(delegationInReadmodelDelegation)
      .where(eq(delegationInReadmodelDelegation.id, delegation.id));

    const { delegationSQL, stampsSQL, contractDocumentsSQL } =
      splitDelegationIntoObjectsSQL(delegation, metadataVersion);

    await tx.insert(delegationInReadmodelDelegation).values(delegationSQL);

    for (const stampSQL of stampsSQL) {
      await tx.insert(delegationStampInReadmodelDelegation).values(stampSQL);
    }

    for (const docSQL of contractDocumentsSQL) {
      await tx
        .insert(delegationContractDocumentInReadmodelDelegation)
        .values(docSQL);
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

export const upsertProducerJWKKey = async (
  readModelDB: DrizzleReturnType,
  jwkKey: ProducerJWKKey,
  metadataVersion: number
): Promise<void> => {
  await readModelDB.transaction(async (tx) => {
    const shouldUpsert = await checkMetadataVersionByFilter(
      tx,
      producerJwkKeyInReadmodelProducerJwkKey,
      metadataVersion,
      and(
        eq(producerJwkKeyInReadmodelProducerJwkKey.kid, jwkKey.kid),
        eq(
          producerJwkKeyInReadmodelProducerJwkKey.producerKeychainId,
          jwkKey.producerKeychainId
        )
      )
    );

    if (!shouldUpsert) {
      return;
    }

    await tx
      .delete(producerJwkKeyInReadmodelProducerJwkKey)
      .where(
        and(
          eq(
            producerJwkKeyInReadmodelProducerJwkKey.producerKeychainId,
            jwkKey.producerKeychainId
          ),
          eq(producerJwkKeyInReadmodelProducerJwkKey.kid, jwkKey.kid)
        )
      );

    const producerJWKKeySQL = splitProducerJWKKeyIntoObjectsSQL(
      jwkKey,
      metadataVersion
    );

    await tx
      .insert(producerJwkKeyInReadmodelProducerJwkKey)
      .values(producerJWKKeySQL);
  });
};

export const upsertProducerKeychain = async (
  readModelDB: DrizzleReturnType,
  producerKeychain: ProducerKeychain,
  metadataVersion: number
): Promise<void> => {
  await readModelDB.transaction(async (tx) => {
    const shouldUpsert = await checkMetadataVersion(
      tx,
      producerKeychainInReadmodelProducerKeychain,
      metadataVersion,
      producerKeychain.id
    );

    if (!shouldUpsert) {
      return;
    }

    await tx
      .delete(producerKeychainInReadmodelProducerKeychain)
      .where(
        eq(producerKeychainInReadmodelProducerKeychain.id, producerKeychain.id)
      );

    const { producerKeychainSQL, usersSQL, eservicesSQL, keysSQL } =
      splitProducerKeychainIntoObjectsSQL(producerKeychain, metadataVersion);

    await tx
      .insert(producerKeychainInReadmodelProducerKeychain)
      .values(producerKeychainSQL);

    for (const userSQL of usersSQL) {
      await tx
        .insert(producerKeychainUserInReadmodelProducerKeychain)
        .values(userSQL);
    }

    for (const eserviceSQL of eservicesSQL) {
      await tx
        .insert(producerKeychainEserviceInReadmodelProducerKeychain)
        .values(eserviceSQL);
    }

    for (const keySQL of keysSQL) {
      await tx
        .insert(producerKeychainKeyInReadmodelProducerKeychain)
        .values(keySQL);
    }
  });
};

export const upsertPurpose = async (
  readModelDB: DrizzleReturnType,
  purpose: Purpose,
  metadataVersion: number
): Promise<void> => {
  await readModelDB.transaction(async (tx) => {
    const shouldUpsert = await checkMetadataVersion(
      tx,
      purposeInReadmodelPurpose,
      metadataVersion,
      purpose.id
    );

    if (!shouldUpsert) {
      return;
    }

    await tx
      .delete(purposeInReadmodelPurpose)
      .where(eq(purposeInReadmodelPurpose.id, purpose.id));

    const {
      purposeSQL,
      riskAnalysisFormSQL,
      riskAnalysisAnswersSQL,
      versionsSQL,
      versionDocumentsSQL,
      versionStampsSQL,
    } = splitPurposeIntoObjectsSQL(purpose, metadataVersion);

    await tx.insert(purposeInReadmodelPurpose).values(purposeSQL);

    if (riskAnalysisFormSQL) {
      await tx
        .insert(purposeRiskAnalysisFormInReadmodelPurpose)
        .values(riskAnalysisFormSQL);
    }

    if (riskAnalysisAnswersSQL) {
      for (const riskAnalysisAnswerSQL of riskAnalysisAnswersSQL) {
        await tx
          .insert(purposeRiskAnalysisAnswerInReadmodelPurpose)
          .values(riskAnalysisAnswerSQL);
      }
    }

    for (const versionSQL of versionsSQL) {
      await tx.insert(purposeVersionInReadmodelPurpose).values(versionSQL);
    }

    for (const versionDocumentSQL of versionDocumentsSQL) {
      await tx
        .insert(purposeVersionDocumentInReadmodelPurpose)
        .values(versionDocumentSQL);
    }

    for (const versionStampSQL of versionStampsSQL) {
      await tx
        .insert(purposeVersionStampInReadmodelPurpose)
        .values(versionStampSQL);
    }
  });
};

export const upsertTenant = async (
  readModelDB: DrizzleReturnType,
  tenant: Tenant,
  metadataVersion: number
): Promise<void> => {
  const {
    tenantSQL,
    mailsSQL,
    certifiedAttributesSQL,
    declaredAttributesSQL,
    verifiedAttributesSQL,
    verifiedAttributeVerifiersSQL,
    verifiedAttributeRevokersSQL,
    featuresSQL,
  } = splitTenantIntoObjectsSQL(tenant, metadataVersion);

  await readModelDB.transaction(async (tx) => {
    const shouldUpsert = await checkMetadataVersion(
      tx,
      tenantInReadmodelTenant,
      metadataVersion,
      tenant.id
    );

    if (!shouldUpsert) {
      return;
    }

    await tx
      .delete(tenantInReadmodelTenant)
      .where(eq(tenantInReadmodelTenant.id, tenant.id));

    await tx.insert(tenantInReadmodelTenant).values(tenantSQL);

    for (const mailSQL of mailsSQL) {
      await tx.insert(tenantMailInReadmodelTenant).values(mailSQL);
    }

    for (const certifiedAttributeSQL of certifiedAttributesSQL) {
      await tx
        .insert(tenantCertifiedAttributeInReadmodelTenant)
        .values(certifiedAttributeSQL);
    }

    for (const declaredAttributeSQL of declaredAttributesSQL) {
      await tx
        .insert(tenantDeclaredAttributeInReadmodelTenant)
        .values(declaredAttributeSQL);
    }

    for (const verifiedAttributeSQL of verifiedAttributesSQL) {
      await tx
        .insert(tenantVerifiedAttributeInReadmodelTenant)
        .values(verifiedAttributeSQL);
    }

    for (const verifierSQL of verifiedAttributeVerifiersSQL) {
      await tx
        .insert(tenantVerifiedAttributeVerifierInReadmodelTenant)
        .values(verifierSQL);
    }

    for (const revokerSQL of verifiedAttributeRevokersSQL) {
      await tx
        .insert(tenantVerifiedAttributeRevokerInReadmodelTenant)
        .values(revokerSQL);
    }

    for (const featureSQL of featuresSQL) {
      await tx.insert(tenantFeatureInReadmodelTenant).values(featureSQL);
    }
  });
};

const updateMetadataVersionInPurposeTemplateTables = async (
  tx: DrizzleTransactionType,
  purposeTemplateId: PurposeTemplateId,
  newMetadataVersion: number,
  tables: typeof purposeTemplateTables = purposeTemplateTables
): Promise<void> => {
  for (const table of tables) {
    await tx
      .update(table)
      .set({ metadataVersion: newMetadataVersion })
      .where(
        and(
          eq(
            "purposeTemplateId" in table ? table.purposeTemplateId : table.id,
            purposeTemplateId
          ),
          lte(table.metadataVersion, newMetadataVersion)
        )
      );
  }
};
export const upsertPurposeTemplate = async (
  readModelDB: DrizzleReturnType,
  purposeTemplate: PurposeTemplate,
  metadataVersion: number
): Promise<void> => {
  await readModelDB.transaction(async (tx) => {
    const shouldUpsert = await checkMetadataVersion(
      tx,
      purposeTemplateInReadmodelPurposeTemplate,
      metadataVersion,
      purposeTemplate.id
    );

    if (!shouldUpsert) {
      return;
    }

    for (const table of purposeTemplateChildTables) {
      if (
        table !== purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate
      ) {
        await tx
          .delete(table)
          .where(eq(table.purposeTemplateId, purposeTemplate.id));
      }
    }

    const {
      purposeTemplateSQL,
      riskAnalysisFormTemplateSQL,
      riskAnalysisTemplateAnswersSQL,
      riskAnalysisTemplateAnswersAnnotationsSQL,
      riskAnalysisTemplateAnswersAnnotationsDocumentsSQL,
    } = splitPurposeTemplateIntoObjectsSQL(purposeTemplate, metadataVersion);

    await tx
      .insert(purposeTemplateInReadmodelPurposeTemplate)
      .values(purposeTemplateSQL)
      .onConflictDoUpdate({
        target: purposeTemplateInReadmodelPurposeTemplate.id,
        set: purposeTemplateSQL,
      });

    if (riskAnalysisFormTemplateSQL) {
      await tx
        .insert(purposeTemplateRiskAnalysisFormInReadmodelPurposeTemplate)
        .values(riskAnalysisFormTemplateSQL);
    }

    if (riskAnalysisTemplateAnswersSQL) {
      for (const answerSQL of riskAnalysisTemplateAnswersSQL) {
        await tx
          .insert(purposeTemplateRiskAnalysisAnswerInReadmodelPurposeTemplate)
          .values(answerSQL);
      }
    }

    for (const annotationSQL of riskAnalysisTemplateAnswersAnnotationsSQL) {
      await tx
        .insert(
          purposeTemplateRiskAnalysisAnswerAnnotationInReadmodelPurposeTemplate
        )
        .values(annotationSQL);
    }

    for (const annotationDocumentSQL of riskAnalysisTemplateAnswersAnnotationsDocumentsSQL) {
      await tx
        .insert(
          purposeTemplateRiskAnalysisAnswerAnnotationDocumentInReadmodelPurposeTemplate
        )
        .values(annotationDocumentSQL);
    }

    await updateMetadataVersionInPurposeTemplateTables(
      tx,
      purposeTemplate.id,
      metadataVersion,
      [purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate]
    );
  });
};

export const upsertPurposeTemplateEServiceDescriptor = async (
  readModelDB: DrizzleReturnType,
  purposeTemplateEServiceDescriptor: EServiceDescriptorPurposeTemplate,
  metadataVersion: number
): Promise<void> => {
  await readModelDB.transaction(async (tx) => {
    const shouldUpsert = await checkMetadataVersion(
      tx,
      purposeTemplateInReadmodelPurposeTemplate,
      metadataVersion,
      purposeTemplateEServiceDescriptor.purposeTemplateId
    );

    if (!shouldUpsert) {
      return;
    }

    await tx
      .delete(purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate)
      .where(
        and(
          eq(
            purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate.purposeTemplateId,
            purposeTemplateEServiceDescriptor.purposeTemplateId
          ),
          eq(
            purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate.eserviceId,
            purposeTemplateEServiceDescriptor.eserviceId
          ),
          eq(
            purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate.descriptorId,
            purposeTemplateEServiceDescriptor.descriptorId
          )
        )
      );

    const purposeTemplateEServiceDescriptorSQL =
      toPurposeTemplateEServiceDescriptorSQL(
        purposeTemplateEServiceDescriptor,
        metadataVersion
      );

    await tx
      .insert(purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate)
      .values(purposeTemplateEServiceDescriptorSQL);
  });
};
