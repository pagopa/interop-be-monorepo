import { eq, SQL } from "drizzle-orm";
import {
  Client,
  ClientId,
  genericInternalError,
  WithMetadata,
} from "pagopa-interop-models";
import {
  clientInReadmodelClient,
  clientKeyInReadmodelClient,
  clientPurposeInReadmodelClient,
  clientUserInReadmodelClient,
  DrizzleReturnType,
} from "pagopa-interop-readmodel-models";
import {
  aggregateClient,
  aggregateClientArray,
  toClientAggregator,
  toClientAggregatorArray,
} from "./aggregators.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function clientReadModelServiceBuilder(db: DrizzleReturnType) {
  return {
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
    async getClients(
      filter: SQL | undefined
    ): Promise<Array<WithMetadata<Client>>> {
      if (filter === undefined) {
        throw genericInternalError("Filter cannot be undefined");
      }

      const queryResult = await db
        .select({
          client: clientInReadmodelClient,
          clientUser: clientUserInReadmodelClient,
          clientPurpose: clientPurposeInReadmodelClient,
          clientKey: clientKeyInReadmodelClient,
        })
        .from(clientInReadmodelClient)
        .where(filter)
        .leftJoin(
          clientUserInReadmodelClient,
          eq(clientInReadmodelClient.id, clientUserInReadmodelClient.clientId)
        )
        .leftJoin(
          clientPurposeInReadmodelClient,
          eq(
            clientInReadmodelClient.id,
            clientPurposeInReadmodelClient.clientId
          )
        )
        .leftJoin(
          clientKeyInReadmodelClient,
          eq(clientInReadmodelClient.id, clientKeyInReadmodelClient.clientId)
        );

      return aggregateClientArray(toClientAggregatorArray(queryResult));
    },
  };
}

export type ClientReadModelService = ReturnType<
  typeof clientReadModelServiceBuilder
>;
