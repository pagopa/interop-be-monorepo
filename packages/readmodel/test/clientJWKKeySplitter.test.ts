import crypto from "crypto";
import {
  getMockClient,
  getMockKey,
} from "pagopa-interop-commons-test/index.js";
import { describe, it, expect } from "vitest";
import { keyToClientJWKKey } from "pagopa-interop-commons";
import { Key } from "pagopa-interop-models";
import { ClientJWKKeySQL } from "pagopa-interop-readmodel-models";
import { splitClientJWKKeyIntoObjectsSQL } from "../src/authorization/clientJWKKeySplitters.js";

describe("Client JWK key splitter", () => {
  it("should convert a client JWK key into a client JWK key SQL object", () => {
    const publicKey = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
    }).publicKey;

    const base64Key = Buffer.from(
      publicKey.export({ type: "pkcs1", format: "pem" })
    ).toString("base64url");

    const client = getMockClient();
    const key: Key = {
      ...getMockKey(),
      encodedPem: base64Key,
    };
    const clientJWKKey = keyToClientJWKKey(key, client.id);

    const clientJWKKeySQL = splitClientJWKKeyIntoObjectsSQL(clientJWKKey, 1);
    const expectedClientJWKKeySQL: ClientJWKKeySQL = {
      ...clientJWKKey,
      clientId: client.id,
      metadataVersion: 1,
    };
    expect(clientJWKKeySQL).toEqual(expectedClientJWKKeySQL);
  });
});
