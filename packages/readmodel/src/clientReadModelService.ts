import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Client, ClientId, WithMetadata } from "pagopa-interop-models";
import {
  clientInReadmodelClient,
  clientKeyInReadmodelClient,
  clientPurposeInReadmodelClient,
  clientUserInReadmodelClient,
} from "pagopa-interop-readmodel-models";
import { splitClientIntoObjectsSQL } from "./authorization/clientSplitters.js";
import {
  aggregateClient,
  toClientAggregator,
} from "./authorization/clientAggregators.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function clientReadModelServiceBuilderSQL(
  db: ReturnType<typeof drizzle>
) {
  return {
    async upsertClient(client: Client, metadataVersion: number): Promise<void> {
      const { clientSQL, usersSQL, purposesSQL, keysSQL } =
        splitClientIntoObjectsSQL(client, metadataVersion);

      await db.transaction(async (tx) => {
        await tx
          .delete(clientInReadmodelClient)
          .where(eq(clientInReadmodelClient.id, client.id));

        await tx.insert(clientInReadmodelClient).values(clientSQL);

        for (const userSQL of usersSQL) {
          await tx.insert(clientUserInReadmodelClient).values(userSQL);
        }

        for (const purposeSQL of purposesSQL) {
          await tx.insert(clientPurposeInReadmodelClient).values(purposeSQL);
        }

        for (const keySQL of keysSQL) {
          await tx.insert(clientKeyInReadmodelClient).values(keySQL);
        }
      });
    },
    async getClientById(
      clientId: ClientId
    ): Promise<WithMetadata<Client> | undefined> {
      /*
        client -> 1 client_user
               -> 2 client_purpose
               -> 3 client_key
      */
      const queryResult = await db
        .select({
          client: clientInReadmodelClient,
          clientUser: clientUserInReadmodelClient,
          clientPurpose: clientPurposeInReadmodelClient,
          clientKey: clientKeyInReadmodelClient,
        })
        .from(clientInReadmodelClient)
        .where(eq(clientInReadmodelClient.id, clientId))
        .leftJoin(
          // 1
          clientUserInReadmodelClient,
          eq(clientInReadmodelClient.id, clientUserInReadmodelClient.clientId)
        )
        .leftJoin(
          // 2
          clientPurposeInReadmodelClient,
          eq(
            clientInReadmodelClient.id,
            clientPurposeInReadmodelClient.clientId
          )
        )
        .leftJoin(
          // 3
          clientKeyInReadmodelClient,
          eq(clientInReadmodelClient.id, clientKeyInReadmodelClient.clientId)
        );

      if (queryResult.length === 0) {
        return undefined;
      }

      return aggregateClient(toClientAggregator(queryResult));
    },
    async deleteClientById(clientId: ClientId): Promise<void> {
      await db
        .delete(clientInReadmodelClient)
        .where(eq(clientInReadmodelClient.id, clientId));
    },
  };
}

export type ClientReadModelService = ReturnType<
  typeof clientReadModelServiceBuilderSQL
>;
