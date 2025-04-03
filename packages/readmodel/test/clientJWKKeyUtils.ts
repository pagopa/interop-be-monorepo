import crypto from "crypto";
import { keyToClientJWKKey } from "pagopa-interop-commons";
import { getMockKey } from "pagopa-interop-commons-test";
import { ClientId, ClientJWKKey } from "pagopa-interop-models";
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

export const getMockClientJWKKey = (clientId: ClientId): ClientJWKKey => {
  const publicKey = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
  }).publicKey;
  const base64Key = Buffer.from(
    publicKey.export({ type: "pkcs1", format: "pem" })
  ).toString("base64url");
  const key = {
    ...getMockKey(),
    encodedPem: base64Key,
  };

  return keyToClientJWKKey(key, clientId);
};

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
