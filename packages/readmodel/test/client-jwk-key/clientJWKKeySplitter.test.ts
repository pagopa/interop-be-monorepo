import { describe, it, expect } from "vitest";
import { ClientId, generateId } from "pagopa-interop-models";
import { ClientJWKKeySQL } from "pagopa-interop-readmodel-models";
import { getMockClientJWKKey } from "pagopa-interop-commons-test";
import { splitClientJWKKeyIntoObjectsSQL } from "../../src/client-jwk-key/splitters.js";

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
    expect(clientJWKKeySQL).toStrictEqual(expectedClientJWKKeySQL);
  });
});
