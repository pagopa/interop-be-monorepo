/* eslint-disable @typescript-eslint/no-floating-promises */
import { generateId } from "pagopa-interop-models";
import { describe, it, expect } from "vitest";
import {
  getMockContext,
  getMockProducerJWKKey,
} from "pagopa-interop-commons-test";
import { authorizationApi } from "pagopa-interop-api-clients";
import { producerJwkNotFound } from "../../src/model/domain/errors.js";
import {
  addOneProducerKey,
  authorizationService,
} from "../integrationUtils.js";

describe("getProducerJWKByKid", async () => {
  const mockKey1 = getMockProducerJWKKey();
  const mockKey2 = getMockProducerJWKKey();

  it("should get the client key if it exists", async () => {
    await addOneProducerKey(mockKey1);
    await addOneProducerKey(mockKey2);

    const expectedKey: authorizationApi.ProducerJWK = {
      producerKeychainId: mockKey1.producerKeychainId,
      jwk: {
        kid: mockKey1.kid,
        kty: mockKey1.kty,
        use: mockKey1.use,
        alg: mockKey1.alg,
        e: mockKey1.e,
        n: mockKey1.n,
      },
    };

    const retrievedKey = await authorizationService.getProducerJWKByKid(
      mockKey1.kid,
      getMockContext({})
    );
    expect(retrievedKey).toEqual(expectedKey);
  });

  it("should throw producerJwkNotFound if the key doesn't exist", async () => {
    const randomKid = generateId();

    expect(
      authorizationService.getProducerJWKByKid(randomKid, getMockContext({}))
    ).rejects.toThrowError(producerJwkNotFound(randomKid));
  });
});
