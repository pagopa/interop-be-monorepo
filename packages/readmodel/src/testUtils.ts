import {
  Agreement,
  Attribute,
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
  DrizzleReturnType,
  tenantEnabledNotificationInReadmodelNotificationConfig,
  tenantNotificationConfigInReadmodelNotificationConfig,
  userEnabledInAppNotificationInReadmodelNotificationConfig,
  userEnabledEmailNotificationInReadmodelNotificationConfig,
  userNotificationConfigInReadmodelNotificationConfig,
} from "pagopa-interop-readmodel-models";
import { eq } from "drizzle-orm";
import {
  splitTenantNotificationConfigIntoObjectsSQL,
  splitUserNotificationConfigIntoObjectsSQL,
} from "./notification-config/splitters.js";
import { splitAgreementIntoObjectsSQL } from "./agreement/splitters.js";
import { checkMetadataVersion } from "./utils.js";
import { splitAttributeIntoObjectsSQL } from "./attribute/splitters.js";

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
