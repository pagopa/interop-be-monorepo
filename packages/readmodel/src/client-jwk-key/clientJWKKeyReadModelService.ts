import { and, eq, SQL } from "drizzle-orm";
import {
  ClientId,
  ClientJWKKey,
  genericInternalError,
  WithMetadata,
} from "pagopa-interop-models";
import {
  clientJwkKeyInReadmodelClientJwkKey,
  DrizzleReturnType,
} from "pagopa-interop-readmodel-models";
import { aggregateClientJWKKey } from "./aggregators.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function clientJWKKeyReadModelServiceBuilder(db: DrizzleReturnType) {
  return {
    async getClientJWKKeyByClientIdAndKid(
      clientId: ClientId,
      kid: string
    ): Promise<WithMetadata<ClientJWKKey> | undefined> {
      return this.getClientJWKKeyByFilter(
        and(
          eq(clientJwkKeyInReadmodelClientJwkKey.clientId, clientId),
          eq(clientJwkKeyInReadmodelClientJwkKey.kid, kid)
        )
      );
    },
    async getClientJWKKeyByFilter(
      filter: SQL | undefined
    ): Promise<WithMetadata<ClientJWKKey> | undefined> {
      if (filter === undefined) {
        throw genericInternalError("Filter cannot be undefined");
      }
      const queryResult = await db
        .select()
        .from(clientJwkKeyInReadmodelClientJwkKey)
        .where(filter);

      if (queryResult.length === 0) {
        return undefined;
      }

      return aggregateClientJWKKey(queryResult[0]);
    },
  };
}
export type ClientJWKKeyReadModelService = ReturnType<
  typeof clientJWKKeyReadModelServiceBuilder
>;
