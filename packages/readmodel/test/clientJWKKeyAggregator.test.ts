import { describe, it, expect } from "vitest";
import { getMockClientJWKKey } from "pagopa-interop-commons-test";
import { splitClientJWKKeyIntoObjectsSQL } from "../src/client-jwk-key/splitters.js";
import { aggregateClientJWKKey } from "../src/client-jwk-key/aggregators.js";

describe("Client JWK key aggregator", () => {
  it("should convert a client JWK key SQL object into a business logic client JWK key", () => {
    const clientJWKKey = getMockClientJWKKey();
    const clientJWKKeySQL = splitClientJWKKeyIntoObjectsSQL(clientJWKKey, 1);

    const aggregatedClientJWKKey = aggregateClientJWKKey(clientJWKKeySQL);
    expect(aggregatedClientJWKKey).toStrictEqual({
      data: clientJWKKey,
      metadata: { version: 1 },
    });
  });
});
