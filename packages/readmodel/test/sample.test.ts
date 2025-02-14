import crypto from "crypto";
import { keyToProducerJWKKey } from "pagopa-interop-commons";
import {
  getMockProducerKeychain,
  getMockKey,
} from "pagopa-interop-commons-test";
import { describe, it, expect } from "vitest";
import { splitProducerJWKKeyIntoObjectsSQL } from "../src/authorization/producerJWKKeySplitters.js";
import { ProducerJWKKeySQL } from "../src/types.js";

describe("Producer JWK key splitter", () => {
  // TODO: add test description
  it("", () => {
    const key = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
    }).publicKey;

    const base64Key = Buffer.from(
      key.export({ type: "pkcs1", format: "pem" })
    ).toString("base64url");

    const mockProducerKeychain = getMockProducerKeychain();
    const mockKey = {
      ...getMockKey(),
      encodedPem: base64Key,
    };
    const jwkKey = keyToProducerJWKKey(mockKey, mockProducerKeychain.id);

    const producerJWKKeySQL = splitProducerJWKKeyIntoObjectsSQL(jwkKey, 1);
    const expectedProducerJWKKeySQL: ProducerJWKKeySQL = {
      producerKeychainId: mockProducerKeychain.id,
      metadataVersion: 1,
      alg: jwkKey.alg,
      e: jwkKey.e,
      kid: jwkKey.kid,
      kty: jwkKey.kty,
      n: jwkKey.n,
      use: jwkKey.use,
    };
    expect(producerJWKKeySQL).toEqual(expectedProducerJWKKeySQL);
  });
});
