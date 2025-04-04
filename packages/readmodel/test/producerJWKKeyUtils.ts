import crypto from "crypto";
import { keyToProducerJWKKey } from "pagopa-interop-commons";
import { getMockKey } from "pagopa-interop-commons-test";
import { ProducerJWKKey, ProducerKeychainId } from "pagopa-interop-models";
import {
  DrizzleReturnType,
  producerJwkKeyInReadmodelProducerJwkKey,
  ProducerJWKKeySQL,
} from "pagopa-interop-readmodel-models";
import { and, eq } from "drizzle-orm";
import { producerJWKKeyReadModelServiceBuilder } from "../src/producerJWKKeyReadModelService.js";
import { readModelDB } from "./utils.js";

export const producerJWKKeyReadModelService =
  producerJWKKeyReadModelServiceBuilder(readModelDB);

export const getMockProducerJWKKey = (
  producerKeychainId: ProducerKeychainId
): ProducerJWKKey => {
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
  return keyToProducerJWKKey(key, producerKeychainId);
};

export const retrieveProducerJWKKeySQLByKid = async (
  producerKeychainId: ProducerKeychainId,
  kid: string,
  db: DrizzleReturnType
): Promise<ProducerJWKKeySQL | undefined> => {
  const result = await db
    .select()
    .from(producerJwkKeyInReadmodelProducerJwkKey)
    .where(
      and(
        eq(
          producerJwkKeyInReadmodelProducerJwkKey.producerKeychainId,
          producerKeychainId
        ),
        eq(producerJwkKeyInReadmodelProducerJwkKey.kid, kid)
      )
    );

  return result[0];
};
