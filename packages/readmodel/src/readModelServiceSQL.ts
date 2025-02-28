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
  fromJoinToAggregatorClient,
} from "./authorization/clientAggregators.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilder(db: ReturnType<typeof drizzle>) {
  return {
    async addClient(client: WithMetadata<Client>): Promise<void> {
      const { clientSQL, usersSQL, purposesSQL, keysSQL } =
        splitClientIntoObjectsSQL(client.data, client.metadata.version);

      await db.transaction(async (tx) => {
        await tx.insert(clientInReadmodelClient).values(clientSQL);

        for (const user of usersSQL) {
          await tx.insert(clientUserInReadmodelClient).values(user);
        }

        for (const purpose of purposesSQL) {
          await tx.insert(clientPurposeInReadmodelClient).values(purpose);
        }

        for (const key of keysSQL) {
          await tx.insert(clientKeyInReadmodelClient).values(key);
        }
      });
    },
    async getClientById(clientId: ClientId): Promise<WithMetadata<Client>> {
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

      const aggregatorInput = fromJoinToAggregatorClient(queryResult);

      return aggregateClient(aggregatorInput);
    },
    async deleteClientById(clientId: ClientId): Promise<void> {
      await db
        .delete(clientInReadmodelClient)
        .where(eq(clientInReadmodelClient.id, clientId));
    },
  };
}

export type ReadModelService = ReturnType<typeof readModelServiceBuilder>;
