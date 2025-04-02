import crypto from "crypto";
import { keyToProducerJWKKey } from "pagopa-interop-commons";
import { getMockKey } from "pagopa-interop-commons-test";
import { ProducerJWKKey, ProducerKeychainId } from "pagopa-interop-models";

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
