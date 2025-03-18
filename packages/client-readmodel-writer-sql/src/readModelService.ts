import { Client, ClientId, PurposeId, UserId } from "pagopa-interop-models";
import { ClientReadModelService } from "pagopa-interop-readmodel";
import {
  DrizzleTransactionType,
  clientInReadmodelClient,
  clientUserInReadModelClient,
  clientPurposeInReadModelClient,
  clientKeyInReadModelClient,
  clientUserInReadmodelClient,
  ClientUserSQL,
  ClientPurposeSQL,
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
      clientUserInReadModelClient,
      clientPurposeInReadModelClient,
      clientKeyInReadModelClient,
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
            eq("client_Id" in table ? table.clientId : table.id, clientId),
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
        await updateMetadataVersionInClientTables(
          tx,
          clientId,
          metadataVersion
        );

        const user: ClientUserSQL = {
          clientId,
          userId,
          metadataVersion,
        };
        await tx.insert(clientUserInReadmodelClient).values(user);
      });
    },

    async removeUser(
      clientId: ClientId,
      userId: UserId,
      metadataVersion: number
    ): Promise<void> {
      await db.transaction(async (tx) => {
        await updateMetadataVersionInClientTables(
          tx,
          clientId,
          metadataVersion
        );

        await tx
          .delete(clientUserInReadmodelClient)
          .where(eq(clientUserInReadModelClient.userId, userId));
      });
    },

    async addPurpose(
      clientId: ClientId,
      purposeId: PurposeId,
      metadataVersion: number
    ): Promise<void> {
      await db.transaction(async (tx) => {
        await updateMetadataVersionInClientTables(
          tx,
          clientId,
          metadataVersion
        );

        const purposeSQL: ClientPurposeSQL = {
          clientId,
          purposeId,
          metadataVersion,
        };
        await tx.insert(clientPurposeInReadModelClient).values(purposeSQL);
      });
    },

    async removePurpose(
      clientId: ClientId,
      purposeId: PurposeId,
      metadataVersion: number
    ): Promise<void> {
      await db.transaction(async (tx) => {
        await updateMetadataVersionInClientTables(
          tx,
          clientId,
          metadataVersion
        );

        await tx
          .delete(clientPurposeInReadModelClient)
          .where(eq(clientPurposeInReadModelClient.purpose, purposeId));
      });
    },

    async addKeys(
      clientId: ClientId,
      keys: Key[],
      metadataVersion: number
    ): Promise<void> {
      await Promise.resolve();
    },

    async deleteKey(
      clientId: ClientId,
      keyId: string,
      metadataVersion: number
    ): Promise<void> {
      await Promise.resolve();
    },
  };
}

export type ReadModelService = ReturnType<typeof readModelServiceBuilder>;
