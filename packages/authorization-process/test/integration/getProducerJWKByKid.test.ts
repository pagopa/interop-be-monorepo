/* eslint-disable @typescript-eslint/no-floating-promises */
import { generateId } from "pagopa-interop-models";
import { describe, it, expect } from "vitest";
import {
  getMockM2MAdminAppContext,
  getMockProducerJWKKey,
} from "pagopa-interop-commons-test";
import { authorizationApi } from "pagopa-interop-api-clients";
import { producerKeyNotFound } from "../../src/model/domain/errors.js";
import {
  addOneProducerKey,
  authorizationService,
} from "../integrationUtils.js";

describe("getProducerJWKByKid", async () => {
  const mockKey1 = getMockProducerJWKKey();
  const mockKey2 = getMockProducerJWKKey();

  await addOneProducerKey(mockKey1);
  await addOneProducerKey(mockKey2);

  it("should get the client key if it exists", async () => {
    const expectedKey: authorizationApi.ProducerJWk = {
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
      getMockM2MAdminAppContext()
    );
    expect(retrievedKey).toEqual(expectedKey);
  });

  it("should throw producerKeyNotFound if the key doesn't exist", async () => {
    const randomKid = generateId();

    expect(
      authorizationService.getJWKByKid(randomKid, getMockM2MAdminAppContext())
    ).rejects.toThrowError(producerKeyNotFound(randomKid, undefined));
  });
});
