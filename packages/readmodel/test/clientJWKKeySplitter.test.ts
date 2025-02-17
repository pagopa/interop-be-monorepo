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
  it("should convert a client JWK key into client JWK key SQL objects", () => {
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
    const clientJWKKey = keyToClientJWKKey(mockKey, mockClient.id);

    const clientJWKKeySQL = splitClientJWKKeyIntoObjectsSQL(clientJWKKey, 1);
    const expectedClientJWKKeySQL: ClientJWKKeySQL = {
      ...clientJWKKey,
      clientId: mockClient.id,
      metadataVersion: 1,
    };
    expect(clientJWKKeySQL).toEqual(expectedClientJWKKeySQL);
  });
});
