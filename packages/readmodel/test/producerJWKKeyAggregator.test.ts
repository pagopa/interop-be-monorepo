import { describe, it, expect } from "vitest";
import { generateId, ProducerKeychainId } from "pagopa-interop-models";
import { splitProducerJWKKeyIntoObjectsSQL } from "../src/authorization/producerJWKKeySplitters.js";
import { aggregateProducerJWKKey } from "../src/authorization/producerJWKKeyAggregators.js";
import { getMockProducerJWKKey } from "./producerJWKKeyUtils.js";

describe("Producer JWK key aggregator", () => {
  it("should convert a producer JWK key SQL object into a business logic producer JWK key", () => {
    const producerKeychainId = generateId<ProducerKeychainId>();
    const producerJWKKey = getMockProducerJWKKey(producerKeychainId);

    const producerJWKKeySQL = splitProducerJWKKeyIntoObjectsSQL(
      producerJWKKey,
      1
    );

    const aggregatedProducerJWKKey = aggregateProducerJWKKey(producerJWKKeySQL);

    expect(aggregatedProducerJWKKey).toStrictEqual(producerJWKKey);
  });
});
