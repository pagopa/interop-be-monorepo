/* eslint-disable @typescript-eslint/no-floating-promises */
import { generateId } from "pagopa-interop-models";
import { describe, it, expect } from "vitest";
import {
  getMockClientJWKKey,
  getMockContext,
} from "pagopa-interop-commons-test";
import { authorizationApi } from "pagopa-interop-api-clients";
import { jwkNotFound } from "../../src/model/domain/errors.js";
import { addOneKey, authorizationService } from "../integrationUtils.js";

describe("getJWKByKid", async () => {
  const mockKey1 = getMockClientJWKKey();
  const mockKey2 = getMockClientJWKKey();

  it("should get the client key if it exists", async () => {
    await addOneKey(mockKey1);
    await addOneKey(mockKey2);

    const expectedKey: authorizationApi.ClientJWK = {
      clientId: mockKey1.clientId,
      jwk: {
        kid: mockKey1.kid,
        kty: mockKey1.kty,
        use: mockKey1.use,
        alg: mockKey1.alg,
        e: mockKey1.e,
        n: mockKey1.n,
      },
    };

    const retrievedKey = await authorizationService.getJWKByKid(
      mockKey1.kid,
      getMockContext({})
    );
    expect(retrievedKey).toEqual(expectedKey);
  });

  it("should throw jwkNotFound if the key doesn't exist", async () => {
    const randomKid = generateId();

    expect(
      authorizationService.getJWKByKid(randomKid, getMockContext({}))
    ).rejects.toThrowError(jwkNotFound(randomKid));
  });
});
