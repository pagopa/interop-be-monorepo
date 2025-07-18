import {
  Client,
  TenantNotificationConfig,
  UserNotificationConfig,
} from "pagopa-interop-models";
import {
  clientInReadmodelClient,
  clientKeyInReadmodelClient,
  clientPurposeInReadmodelClient,
  clientUserInReadmodelClient,
  DrizzleReturnType,
  tenantNotificationConfigInReadmodelNotificationConfig,
  userNotificationConfigInReadmodelNotificationConfig,
} from "pagopa-interop-readmodel-models";
import { eq } from "drizzle-orm";
import {
  splitTenantNotificationConfigIntoObjectsSQL,
  splitUserNotificationConfigIntoObjectsSQL,
} from "./notification-config/splitters.js";
import { checkMetadataVersion } from "./utils.js";
import { splitClientIntoObjectsSQL } from "./authorization/clientSplitters.js";

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
