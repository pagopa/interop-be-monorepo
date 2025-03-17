import { describe, it, expect } from "vitest";
import { ClientId, generateId } from "pagopa-interop-models";
import { ClientJWKKeySQL } from "pagopa-interop-readmodel-models";
import { splitClientJWKKeyIntoObjectsSQL } from "../src/authorization/clientJWKKeySplitters.js";
import { getMockClientJWKKey } from "./clientJWKKeyUtils.js";

describe("Client JWK key splitter", () => {
  it("should convert a client JWK key into a client JWK key SQL object", () => {
    const clientId = generateId<ClientId>();
    const clientJWKKey = getMockClientJWKKey(clientId);

    const clientJWKKeySQL = splitClientJWKKeyIntoObjectsSQL(clientJWKKey, 1);
    const expectedClientJWKKeySQL: ClientJWKKeySQL = {
      ...clientJWKKey,
      clientId,
      metadataVersion: 1,
    };
    expect(clientJWKKeySQL).toEqual(expectedClientJWKKeySQL);
  });
});
