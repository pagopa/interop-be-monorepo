import {
  Agreement,
  Attribute,
  Client,
  ClientJWKKey,
  Delegation,
  EService,
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
  tenantEnabledNotificationInReadmodelNotificationConfig,
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
} from "pagopa-interop-readmodel-models";
import { and, eq } from "drizzle-orm";
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

export const insertTenantNotificationConfig = async (
  readModelDB: DrizzleReturnType,
  tenantNotificationConfig: TenantNotificationConfig,
  metadataVersion: number
): Promise<void> => {
  const { tenantNotificationConfigSQL, enabledNotificationsSQL } =
    splitTenantNotificationConfigIntoObjectsSQL(
      tenantNotificationConfig,
      metadataVersion
    );

  await readModelDB.transaction(async (tx) => {
    await tx
      .insert(tenantNotificationConfigInReadmodelNotificationConfig)
      .values(tenantNotificationConfigSQL);
    if (enabledNotificationsSQL.length > 0) {
      await tx
        .insert(tenantEnabledNotificationInReadmodelNotificationConfig)
        .values(enabledNotificationsSQL);
    }
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
