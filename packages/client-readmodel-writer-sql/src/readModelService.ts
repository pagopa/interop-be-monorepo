import {
  Client,
  ClientId,
  dateToString,
  Key,
  PurposeId,
  UserId,
} from "pagopa-interop-models";
import { ClientReadModelService } from "pagopa-interop-readmodel";
import {
  DrizzleTransactionType,
  clientInReadmodelClient,
  clientUserInReadmodelClient,
  clientPurposeInReadmodelClient,
  clientKeyInReadmodelClient,
  ClientUserSQL,
  ClientPurposeSQL,
  ClientKeySQL,
} from "pagopa-interop-readmodel-models";
import { and, eq, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilder(
  db: ReturnType<typeof drizzle>,
  clientReadModelService: ClientReadModelService
) {
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

    await tx
      .update(clientInReadmodelClient)
      .set({ metadataVersion: newMetadataVersion })
      .where(
        and(
          eq(clientInReadmodelClient.id, clientId),
          lte(clientInReadmodelClient.metadataVersion, newMetadataVersion)
        )
      );

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
      return await clientReadModelService.upsertClient(client, metadataVersion);
    },

    async deleteClientById(
      clientId: ClientId,
      metadataVersion: number
    ): Promise<void> {
      return clientReadModelService.deleteClientById(clientId, metadataVersion);
    },

    async addUser(
      clientId: ClientId,
      userId: UserId,
      metadataVersion: number
    ): Promise<void> {
      await db.transaction(async (tx) => {
        const user: ClientUserSQL = {
          clientId,
          userId,
          metadataVersion,
        };
        await tx.insert(clientUserInReadmodelClient).values(user);

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
          .where(eq(clientUserInReadmodelClient.userId, userId));

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
        const purposeSQL: ClientPurposeSQL = {
          clientId,
          purposeId,
          metadataVersion,
        };
        await tx.insert(clientPurposeInReadmodelClient).values(purposeSQL);

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
          .where(eq(clientPurposeInReadmodelClient.purposeId, purposeId));

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
      await db.transaction(async (tx) => {
        const keysSQL: ClientKeySQL[] = keys.map((key) => ({
          metadataVersion,
          clientId,
          userId: key.userId,
          kid: key.kid,
          name: key.name,
          encodedPem: key.encodedPem,
          algorithm: key.algorithm,
          use: key.use,
          createdAt: dateToString(key.createdAt),
        }));
        await tx.insert(clientKeyInReadmodelClient).values(keysSQL);

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
          .where(eq(clientKeyInReadmodelClient.kid, keyId));

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

export type ReadModelService = ReturnType<typeof readModelServiceBuilder>;
