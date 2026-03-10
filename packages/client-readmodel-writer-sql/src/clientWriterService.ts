import {
  Client,
  ClientId,
  dateToString,
  Key,
  PurposeId,
  UserId,
} from "pagopa-interop-models";
import {
  checkMetadataVersion,
  splitClientIntoObjectsSQL,
} from "pagopa-interop-readmodel";
import {
  DrizzleTransactionType,
  clientInReadmodelClient,
  clientUserInReadmodelClient,
  clientPurposeInReadmodelClient,
  clientKeyInReadmodelClient,
  ClientUserSQL,
  ClientPurposeSQL,
  ClientKeySQL,
  DrizzleReturnType,
} from "pagopa-interop-readmodel-models";
import { and, eq, lte } from "drizzle-orm";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function clientWriterServiceBuilder(db: DrizzleReturnType) {
  const updateMetadataVersionInClientTables = async (
    tx: DrizzleTransactionType,
    clientId: ClientId,
    newMetadataVersion: number
  ): Promise<void> => {
    const clientRelatedTables = [
      clientInReadmodelClient,
      clientUserInReadmodelClient,
      clientPurposeInReadmodelClient,
      clientKeyInReadmodelClient,
    ];

    for (const table of clientRelatedTables) {
      await tx
        .update(table)
        .set({ metadataVersion: newMetadataVersion })
        .where(
          and(
            eq("clientId" in table ? table.clientId : table.id, clientId),
            lte(table.metadataVersion, newMetadataVersion)
          )
        );
    }
  };

  return {
    async upsertClient(client: Client, metadataVersion: number): Promise<void> {
      await db.transaction(async (tx) => {
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
    },

    async deleteClientById(
      clientId: ClientId,
      metadataVersion: number
    ): Promise<void> {
      await db
        .delete(clientInReadmodelClient)
        .where(
          and(
            eq(clientInReadmodelClient.id, clientId),
            lte(clientInReadmodelClient.metadataVersion, metadataVersion)
          )
        );
    },

    async addUser(
      clientId: ClientId,
      userId: UserId,
      metadataVersion: number
    ): Promise<void> {
      await db.transaction(async (tx) => {
        const shouldAdd = await checkMetadataVersion(
          tx,
          clientInReadmodelClient,
          metadataVersion,
          clientId
        );

        if (!shouldAdd) {
          return;
        }

        const user: ClientUserSQL = {
          clientId,
          userId,
          metadataVersion,
        };

        await tx
          .insert(clientUserInReadmodelClient)
          .values(user)
          .onConflictDoNothing();

        await updateMetadataVersionInClientTables(
          tx,
          clientId,
          metadataVersion
        );
      });
    },

    async removeUser(
      clientId: ClientId,
      userId: UserId,
      metadataVersion: number
    ): Promise<void> {
      await db.transaction(async (tx) => {
        await tx
          .delete(clientUserInReadmodelClient)
          .where(
            and(
              eq(clientUserInReadmodelClient.clientId, clientId),
              eq(clientUserInReadmodelClient.userId, userId),
              lte(clientUserInReadmodelClient.metadataVersion, metadataVersion)
            )
          );

        await updateMetadataVersionInClientTables(
          tx,
          clientId,
          metadataVersion
        );
      });
    },

    async addPurpose(
      clientId: ClientId,
      purposeId: PurposeId,
      metadataVersion: number
    ): Promise<void> {
      await db.transaction(async (tx) => {
        const shouldAdd = await checkMetadataVersion(
          tx,
          clientInReadmodelClient,
          metadataVersion,
          clientId
        );

        if (!shouldAdd) {
          return;
        }

        const purposeSQL: ClientPurposeSQL = {
          clientId,
          purposeId,
          metadataVersion,
        };
        await tx
          .insert(clientPurposeInReadmodelClient)
          .values(purposeSQL)
          .onConflictDoNothing();

        await updateMetadataVersionInClientTables(
          tx,
          clientId,
          metadataVersion
        );
      });
    },

    async removePurpose(
      clientId: ClientId,
      purposeId: PurposeId,
      metadataVersion: number
    ): Promise<void> {
      await db.transaction(async (tx) => {
        await tx
          .delete(clientPurposeInReadmodelClient)
          .where(
            and(
              eq(clientPurposeInReadmodelClient.clientId, clientId),
              eq(clientPurposeInReadmodelClient.purposeId, purposeId),
              lte(
                clientPurposeInReadmodelClient.metadataVersion,
                metadataVersion
              )
            )
          );

        await updateMetadataVersionInClientTables(
          tx,
          clientId,
          metadataVersion
        );
      });
    },

    async addKeys(
      clientId: ClientId,
      keys: Key[],
      metadataVersion: number
    ): Promise<void> {
      if (keys.length === 0) {
        return;
      }

      await db.transaction(async (tx) => {
        const shouldAdd = await checkMetadataVersion(
          tx,
          clientInReadmodelClient,
          metadataVersion,
          clientId
        );

        if (!shouldAdd) {
          return;
        }

        const keysSQL: ClientKeySQL[] = keys.map((key) => ({
          metadataVersion,
          clientId,
          userId: key.userId !== "" ? key.userId : null,
          kid: key.kid,
          name: key.name,
          encodedPem: key.encodedPem,
          algorithm: key.algorithm,
          use: key.use,
          createdAt: dateToString(key.createdAt),
        }));
        await tx
          .insert(clientKeyInReadmodelClient)
          .values(keysSQL)
          .onConflictDoNothing();

        await updateMetadataVersionInClientTables(
          tx,
          clientId,
          metadataVersion
        );
      });
    },

    async deleteKey(
      clientId: ClientId,
      keyId: string,
      metadataVersion: number
    ): Promise<void> {
      await db.transaction(async (tx) => {
        await tx
          .delete(clientKeyInReadmodelClient)
          .where(
            and(
              eq(clientKeyInReadmodelClient.clientId, clientId),
              eq(clientKeyInReadmodelClient.kid, keyId),
              lte(clientKeyInReadmodelClient.metadataVersion, metadataVersion)
            )
          );

        await updateMetadataVersionInClientTables(
          tx,
          clientId,
          metadataVersion
        );
      });
    },

    async migrateKeyRelationshipToUser(
      clientId: ClientId,
      keyId: string,
      userId: UserId,
      metadataVersion: number
    ): Promise<void> {
      await db.transaction(async (tx) => {
        await tx
          .update(clientKeyInReadmodelClient)
          .set({ userId })
          .where(
            and(
              eq(clientKeyInReadmodelClient.clientId, clientId),
              eq(clientKeyInReadmodelClient.kid, keyId),
              lte(clientKeyInReadmodelClient.metadataVersion, metadataVersion)
            )
          );

        await updateMetadataVersionInClientTables(
          tx,
          clientId,
          metadataVersion
        );
      });
    },
  };
}
export type ClientWriterService = ReturnType<typeof clientWriterServiceBuilder>;
