import { describe, it, expect } from "vitest";
import { getMockProducerJWKKey } from "pagopa-interop-commons-test";
import { splitProducerJWKKeyIntoObjectsSQL } from "../../../src/authorization/producer-key/producerJWKKeySplitters.js";
import { aggregateProducerJWKKey } from "../../../src/authorization/producer-key/producerJWKKeyAggregators.js";

describe("Producer JWK key aggregator", () => {
  it("should convert a producer JWK key SQL object into a business logic producer JWK key", () => {
    const producerJWKKey = getMockProducerJWKKey();

    const producerJWKKeySQL = splitProducerJWKKeyIntoObjectsSQL(
      producerJWKKey,
      1
    );

    const aggregatedProducerJWKKey = aggregateProducerJWKKey(producerJWKKeySQL);

    expect(aggregatedProducerJWKKey).toStrictEqual({
      data: producerJWKKey,
      metadata: { version: 1 },
    });
  });
});
