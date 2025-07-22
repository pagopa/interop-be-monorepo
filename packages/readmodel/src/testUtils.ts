import {
  Agreement,
  Attribute,
  ProducerJWKKey,
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
  producerJwkKeyInReadmodelProducerJwkKey,
  tenantNotificationConfigInReadmodelNotificationConfig,
  userNotificationConfigInReadmodelNotificationConfig,
} from "pagopa-interop-readmodel-models";
import { and, eq } from "drizzle-orm";
import {
  splitTenantNotificationConfigIntoObjectsSQL,
  splitUserNotificationConfigIntoObjectsSQL,
} from "./notification-config/splitters.js";
import { splitAgreementIntoObjectsSQL } from "./agreement/splitters.js";
import { checkMetadataVersion, checkMetadataVersionByFilter } from "./utils.js";
import { splitAttributeIntoObjectsSQL } from "./attribute/splitters.js";
import { splitProducerJWKKeyIntoObjectsSQL } from "./authorization/producerJWKKeySplitters.js";

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
