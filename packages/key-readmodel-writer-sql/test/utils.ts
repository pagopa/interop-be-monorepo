import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { clientJWKKeyReadModelServiceBuilder } from "pagopa-interop-readmodel";
import { inject, afterEach } from "vitest";
import { ClientId } from "pagopa-interop-models";
import { and, eq } from "drizzle-orm";
import {
  DrizzleReturnType,
  ClientJWKKeySQL,
  clientJwkKeyInReadmodelClientJwkKey,
} from "pagopa-interop-readmodel-models";
import { clientJWKKeyWriterServiceBuilder } from "../src/clientJWKKeyWriterService.js";

export const { cleanup, readModelDB } = await setupTestContainersVitest(
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  inject("readModelSQLConfig")
);

afterEach(cleanup);

export const clientJWKKeyReadModelService =
  clientJWKKeyReadModelServiceBuilder(readModelDB);

export const clientJWKKeyWriterService =
  clientJWKKeyWriterServiceBuilder(readModelDB);

export const retrieveClientJWKKeySQLByClientIdAndKid = async (
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
