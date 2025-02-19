import crypto from "crypto";
import { keyToProducerJWKKey } from "pagopa-interop-commons";
import {
  getMockProducerKeychain,
  getMockKey,
} from "pagopa-interop-commons-test";
import { describe, it, expect } from "vitest";
import { ProducerJWKKey, WithMetadata } from "pagopa-interop-models";
import { splitProducerJWKKeyIntoObjectsSQL } from "../src/authorization/producerJWKKeySplitters.js";
import { producerJWKKeySQLToProducerJWKKey } from "../src/authorization/producerJWKKeyAggregators.js";

describe("Producer JWK key aggregator", () => {
  it("should convert a producer JWK key SQL object into a business logic producer JWK key", () => {
    const publicKey = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
    }).publicKey;

    const base64Key = Buffer.from(
      publicKey.export({ type: "pkcs1", format: "pem" })
    ).toString("base64url");

    const producerKeychain = getMockProducerKeychain();
    const key = {
      ...getMockKey(),
      encodedPem: base64Key,
    };
    const producerJWKKey: WithMetadata<ProducerJWKKey> = {
      data: keyToProducerJWKKey(key, producerKeychain.id),
      metadata: { version: 1 },
    };

    const producerJWKKeySQL = splitProducerJWKKeyIntoObjectsSQL(
      producerJWKKey.data,
      1
    );

    const aggregatedProducerJWKKey =
      producerJWKKeySQLToProducerJWKKey(producerJWKKeySQL);

    expect(aggregatedProducerJWKKey).toEqual(producerJWKKey);
  });
});
