import crypto from "crypto";
import {
  getMockClient,
  getMockKey,
} from "pagopa-interop-commons-test/index.js";
import { describe, it, expect } from "vitest";
import { keyToClientJWKKey } from "pagopa-interop-commons";
import { Key } from "pagopa-interop-models";
import { splitClientJWKKeyIntoObjectsSQL } from "../src/authorization/clientJWKKeySplitters.js";
import { ClientJWKKeySQL } from "../src/types.js";

describe("Client JWK key splitter", () => {
  // TODO: add test description
  it("", () => {
    const key = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
    }).publicKey;

    const base64Key = Buffer.from(
      key.export({ type: "pkcs1", format: "pem" })
    ).toString("base64url");

    const mockClient = getMockClient();
    const mockKey: Key = {
      ...getMockKey(),
      encodedPem: base64Key,
    };
    const jwkKey = keyToClientJWKKey(mockKey, mockClient.id);

    const clientJWKKeySQL = splitClientJWKKeyIntoObjectsSQL(jwkKey, 1);
    const expectedClientJWKKeySQL: ClientJWKKeySQL = {
      clientId: mockClient.id,
      metadataVersion: 1,
      alg: jwkKey.alg,
      e: jwkKey.e,
      kid: jwkKey.kid,
      kty: jwkKey.kty,
      n: jwkKey.n,
      use: jwkKey.use,
    };
    expect(clientJWKKeySQL).toEqual(expectedClientJWKKeySQL);
  });
});
