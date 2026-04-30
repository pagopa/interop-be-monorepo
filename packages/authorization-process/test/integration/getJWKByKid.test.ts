/* eslint-disable @typescript-eslint/no-floating-promises */
import { generateId, TenantId } from "pagopa-interop-models";
import { describe, it, expect } from "vitest";
import {
  getMockClient,
  getMockClientJWKKey,
  getMockContextM2M,
} from "pagopa-interop-commons-test";
import { authorizationApi } from "pagopa-interop-api-clients";
import {
  jwkNotFound,
  tenantNotAllowedOnClient,
} from "../../src/model/domain/errors.js";
import {
  addOneClient,
  addOneKey,
  authorizationService,
} from "../integrationUtils.js";

describe("getJWKByKid", async () => {
  const client = getMockClient();
  const mockKey1 = getMockClientJWKKey(client.id);
  const mockKey2 = getMockClientJWKKey();

  it("should get the client key if it exists", async () => {
    await addOneClient(client);
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
      getMockContextM2M({
        organizationId: client.consumerId,
      })
    );
    expect(retrievedKey).toEqual(expectedKey);
  });

  it("should throw if the requester is not the client consumer", async () => {
    const requesterId = generateId<TenantId>();

    await addOneClient(client);
    await addOneKey(mockKey1);

    await expect(
      authorizationService.getJWKByKid(
        mockKey1.kid,
        getMockContextM2M({
          organizationId: requesterId,
        })
      )
    ).rejects.toThrowError(tenantNotAllowedOnClient(requesterId, client.id));
  });

  it("should throw jwkNotFound if the key doesn't exist", async () => {
    const randomKid = generateId();

    await expect(
      authorizationService.getJWKByKid(randomKid, getMockContextM2M({}))
    ).rejects.toThrowError(jwkNotFound(randomKid));
  });
});
