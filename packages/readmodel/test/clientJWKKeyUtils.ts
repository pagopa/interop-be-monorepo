import crypto from "crypto";
import { keyToClientJWKKey } from "pagopa-interop-commons";
import { getMockKey } from "pagopa-interop-commons-test";
import { ClientId, ClientJWKKey } from "pagopa-interop-models";

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
