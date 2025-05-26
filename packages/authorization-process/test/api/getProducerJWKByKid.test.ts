/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { generateId } from "pagopa-interop-models";
import {
  generateToken,
  getMockProducerJWKKey,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { authorizationApi } from "pagopa-interop-api-clients";
import { api, authorizationService } from "../vitest.api.setup.js";
import { producerKeyNotFound } from "../../src/model/domain/errors.js";

describe("API /producerKeys/{keyId} authorization test", () => {
  const mockKey = getMockProducerJWKKey();
  const expectedKey: authorizationApi.ProducerJWK = {
    producerKeychainId: mockKey.producerKeychainId,
    jwk: {
      kid: mockKey.kid,
      kty: mockKey.kty,
      use: mockKey.use,
      alg: mockKey.alg,
      e: mockKey.e,
      n: mockKey.n,
    },
  };

  authorizationService.getProducerJWKByKid = vi
    .fn()
    .mockResolvedValue(expectedKey);

  const makeRequest = async (token: string, keyId: string) =>
    request(api)
      .get(`/producerKeys/${keyId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  const authorizedRoles: AuthRole[] = [
    authRole.M2M_ADMIN_ROLE,
    authRole.ADMIN_ROLE,
    authRole.M2M_ROLE,
  ];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, mockKey.kid);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(expectedKey);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockKey.kid);

    expect(res.status).toBe(403);
  });

  it("Should return 404 for producerKeyNotFound", async () => {
    authorizationService.getProducerJWKByKid = vi
      .fn()
      .mockRejectedValue(producerKeyNotFound(mockKey.kid, undefined));
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, mockKey.kid);
    expect(res.status).toBe(404);
  });

  it.each([
    {},
    {
      ...expectedKey,
      producerKeychainId: "invalidUuid",
    },
    {
      ...expectedKey,
      invalidParam: "invalidValue",
    },
    {
      ...expectedKey,
      kid: undefined,
    },
    {
      extraParam: "extraValue",
    },
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      authorizationService.getProducerJWKByKid = vi
        .fn()
        .mockResolvedValueOnce(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, mockKey.kid);

      expect(res.status).toBe(500);
    }
  );
});
