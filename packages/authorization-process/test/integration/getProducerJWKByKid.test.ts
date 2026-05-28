/* eslint-disable @typescript-eslint/no-floating-promises */
import { generateId, TenantId } from "pagopa-interop-models";
import { describe, it, expect } from "vitest";
import {
  getMockContextM2M,
  getMockProducerKeychain,
  getMockProducerJWKKey,
} from "pagopa-interop-commons-test";
import { authorizationApi } from "pagopa-interop-api-clients";
import {
  producerJwkNotFound,
  tenantNotAllowedOnProducerKeychain,
} from "../../src/model/domain/errors.js";
import {
  addOneProducerKeychain,
  addOneProducerKey,
  authorizationService,
} from "../integrationUtils.js";

describe("getProducerJWKByKid", async () => {
  const producerKeychain = getMockProducerKeychain();
  const mockKey1 = getMockProducerJWKKey(producerKeychain.id);
  const mockKey2 = getMockProducerJWKKey();

  it("should get the client key if it exists", async () => {
    await addOneProducerKeychain(producerKeychain);
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
      getMockContextM2M({
        organizationId: producerKeychain.producerId,
      })
    );
    expect(retrievedKey).toEqual(expectedKey);
  });

  it("should throw if the requester is not the keychain producer", async () => {
    const requesterId = generateId<TenantId>();

    await addOneProducerKeychain(producerKeychain);
    await addOneProducerKey(mockKey1);

    await expect(
      authorizationService.getProducerJWKByKid(
        mockKey1.kid,
        getMockContextM2M({
          organizationId: requesterId,
        })
      )
    ).rejects.toThrowError(
      tenantNotAllowedOnProducerKeychain(requesterId, producerKeychain.id)
    );
  });

  it("should throw producerJwkNotFound if the key doesn't exist", async () => {
    const randomKid = generateId();

    await expect(
      authorizationService.getProducerJWKByKid(randomKid, getMockContextM2M({}))
    ).rejects.toThrowError(producerJwkNotFound(randomKid));
  });
});
