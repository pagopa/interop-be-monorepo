import {
  Delegation,
  TenantNotificationConfig,
  UserNotificationConfig,
} from "pagopa-interop-models";
import {
  delegationContractDocumentInReadmodelDelegation,
  delegationInReadmodelDelegation,
  delegationStampInReadmodelDelegation,
  DrizzleReturnType,
  tenantNotificationConfigInReadmodelNotificationConfig,
  userNotificationConfigInReadmodelNotificationConfig,
} from "pagopa-interop-readmodel-models";
import { eq } from "drizzle-orm";
import {
  splitTenantNotificationConfigIntoObjectsSQL,
  splitUserNotificationConfigIntoObjectsSQL,
} from "./notification-config/splitters.js";
import { splitDelegationIntoObjectsSQL } from "./delegation/splitters.js";
import { checkMetadataVersion } from "./utils.js";

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
