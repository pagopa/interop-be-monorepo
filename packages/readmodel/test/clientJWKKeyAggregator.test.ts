import crypto from "crypto";
import { getMockClient, getMockKey } from "pagopa-interop-commons-test";
import { describe, it, expect } from "vitest";
import { keyToClientJWKKey } from "pagopa-interop-commons";
import { Key } from "pagopa-interop-models";
import { splitClientJWKKeyIntoObjectsSQL } from "../src/authorization/clientJWKKeySplitters.js";
import { aggregateClientJWKKey } from "../src/authorization/clientJWKKeyAggregators.js";

describe("Client JWK key aggregator", () => {
  it("should convert a client JWK key SQL object into a business logic client JWK key", () => {
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

    const aggregatedClientJWKKey = aggregateClientJWKKey(clientJWKKeySQL);
    expect(aggregatedClientJWKKey).toMatchObject(aggregatedClientJWKKey);
  });
});
