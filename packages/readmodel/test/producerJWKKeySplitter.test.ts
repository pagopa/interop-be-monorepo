import crypto from "crypto";
import { keyToProducerJWKKey } from "pagopa-interop-commons";
import {
  getMockProducerKeychain,
  getMockKey,
} from "pagopa-interop-commons-test";
import { describe, it, expect } from "vitest";
import { ProducerJWKKeySQL } from "pagopa-interop-readmodel-models";
import { splitProducerJWKKeyIntoObjectsSQL } from "../src/authorization/producerJWKKeySplitters.js";

describe("Producer JWK key splitter", () => {
  it("should convert a producer JWK key into producer JWK key SQL objects", () => {
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
    const producerJWKKey = keyToProducerJWKKey(key, producerKeychain.id);

    const producerJWKKeySQL = splitProducerJWKKeyIntoObjectsSQL(
      producerJWKKey,
      1
    );
    const expectedProducerJWKKeySQL: ProducerJWKKeySQL = {
      ...producerJWKKey,
      producerKeychainId: producerKeychain.id,
      metadataVersion: 1,
    };
    expect(producerJWKKeySQL).toEqual(expectedProducerJWKKeySQL);
  });
});
