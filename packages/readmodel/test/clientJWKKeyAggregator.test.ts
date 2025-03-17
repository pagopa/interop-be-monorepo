import { describe, it, expect } from "vitest";
import { ClientId, generateId } from "pagopa-interop-models";
import { splitClientJWKKeyIntoObjectsSQL } from "../src/authorization/clientJWKKeySplitters.js";
import { aggregateClientJWKKey } from "../src/authorization/clientJWKKeyAggregators.js";
import { getMockClientJWKKey } from "./clientJWKKeyUtils.js";

describe("Client JWK key aggregator", () => {
  it("should convert a client JWK key SQL object into a business logic client JWK key", () => {
    const clientId = generateId<ClientId>();
    const clientJWKKey = getMockClientJWKKey(clientId);
    const clientJWKKeySQL = splitClientJWKKeyIntoObjectsSQL(clientJWKKey, 1);

    const aggregatedClientJWKKey = aggregateClientJWKKey(clientJWKKeySQL);
    expect(aggregatedClientJWKKey).toMatchObject(aggregatedClientJWKKey);
  });
});
