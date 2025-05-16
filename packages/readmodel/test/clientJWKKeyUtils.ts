import { ClientId } from "pagopa-interop-models";
import {
  clientJwkKeyInReadmodelClientJwkKey,
  ClientJWKKeySQL,
  DrizzleReturnType,
} from "pagopa-interop-readmodel-models";
import { and, eq } from "drizzle-orm";
import { clientJWKKeyReadModelServiceBuilder } from "../src/clientJWKKeyReadModelService.js";
import { readModelDB } from "./utils.js";

export const clientJWKKeyReadModelService =
  clientJWKKeyReadModelServiceBuilder(readModelDB);

export const retrieveClientJWKKeySQLByKid = async (
  clientId: ClientId,
  kid: string,
  db: DrizzleReturnType
): Promise<ClientJWKKeySQL | undefined> => {
  const result = await db
    .select()
    .from(clientJwkKeyInReadmodelClientJwkKey)
    .where(
      and(
        eq(clientJwkKeyInReadmodelClientJwkKey.clientId, clientId),
        eq(clientJwkKeyInReadmodelClientJwkKey.kid, kid)
      )
    );

  return result[0];
};
