import { describe, it, expect } from "vitest";
import { ProducerJWKKeySQL } from "pagopa-interop-readmodel-models";
import { generateId, ProducerKeychainId } from "pagopa-interop-models";
import { splitProducerJWKKeyIntoObjectsSQL } from "../src/authorization/producerJWKKeySplitters.js";
import { getMockProducerJWKKey } from "./producerJWKKeyUtils.js";

describe("Producer JWK key splitter", () => {
  it("should convert a producer JWK key into a producer JWK key SQL object", () => {
    const producerKeychainId = generateId<ProducerKeychainId>();
    const producerJWKKey = getMockProducerJWKKey(producerKeychainId);

    const producerJWKKeySQL = splitProducerJWKKeyIntoObjectsSQL(
      producerJWKKey,
      1
    );
    const expectedProducerJWKKeySQL: ProducerJWKKeySQL = {
      ...producerJWKKey,
      producerKeychainId,
      metadataVersion: 1,
    };
    expect(producerJWKKeySQL).toEqual(expectedProducerJWKKeySQL);
  });
});
