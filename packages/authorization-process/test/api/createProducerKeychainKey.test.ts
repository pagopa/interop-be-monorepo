/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import {
  generateId,
  invalidKeyLength,
  invalidPublicKey,
  notAnRSAKey,
  ProducerKeychain,
  ProducerKeychainId,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockKey,
  getMockProducerKeychain,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { authorizationApi } from "pagopa-interop-api-clients";
import { api, authorizationService } from "../vitest.api.setup.js";
import { keyToApiKey } from "../../src/model/domain/apiConverter.js";
import {
  tenantNotAllowedOnProducerKeychain,
  producerKeychainNotFound,
  tooManyKeysPerProducerKeychain,
} from "../../src/model/domain/errors.js";

describe("API /producerKeychains/{producerKeychainId}/keys authorization test", () => {
  const keySeed: authorizationApi.KeySeed = {
    name: "key seed",
    use: "ENC",
    key: `MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAsFakePem`,
    alg: "",
  };

  const mockKey = getMockKey();

  const mockProducerKeychain: ProducerKeychain = getMockProducerKeychain();

  const apiKey: authorizationApi.Key = keyToApiKey(mockKey);

  authorizationService.createProducerKeychainKey = vi
    .fn()
    .mockResolvedValue(mockKey);

  const makeRequest = async (
    token: string,
    producerKeychainId: ProducerKeychainId,
    body: authorizationApi.KeySeed = keySeed
  ) =>
    request(api)
      .post(`/producerKeychains/${producerKeychainId}/keys`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.SECURITY_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];

  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, mockProducerKeychain.id);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiKey);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockProducerKeychain.id);
    expect(res.status).toBe(403);
  });

  it.each([
    {
      error: producerKeychainNotFound(mockProducerKeychain.id),
      expectedStatus: 404,
    },
    {
      error: tooManyKeysPerProducerKeychain(mockProducerKeychain.id, 1),
      expectedStatus: 400,
    },
    {
      error: invalidPublicKey(),
      expectedStatus: 400,
    },
    {
      error: notAnRSAKey(),
      expectedStatus: 400,
    },
    {
      error: invalidKeyLength(mockKey.encodedPem.length),
      expectedStatus: 400,
    },
    {
      error: tenantNotAllowedOnProducerKeychain(
        generateId(),
        mockProducerKeychain.id
      ),
      expectedStatus: 403,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      authorizationService.createProducerKeychainKey = vi
        .fn()
        .mockRejectedValue(error);

      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, mockProducerKeychain.id);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    [{}, mockProducerKeychain.id],
    [{ ...keySeed, invalidParam: "invalidValue" }, mockProducerKeychain.id],
    [{ ...keySeed, name: 1 }, mockProducerKeychain.id],
    [{ ...keySeed, use: "invalidUse" }, mockProducerKeychain.id],
    [{ ...keySeed, alg: 1 }, mockProducerKeychain.id],
    [{ ...keySeed, key: 1 }, mockProducerKeychain.id],
    [{ ...keySeed, name: undefined }, mockProducerKeychain.id],
    [{ ...keySeed, use: undefined }, mockProducerKeychain.id],
    [{ ...keySeed, alg: undefined }, mockProducerKeychain.id],
    [{ ...keySeed, key: undefined }, mockProducerKeychain.id],
    [{ ...keySeed }, "invalidId"],
  ])(
    "Should return 400 if passed invalid params: %s (producerKeychainId: %s)",
    async (body, producerKeychainId) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        producerKeychainId as ProducerKeychainId,
        body as authorizationApi.KeySeed
      );

      expect(res.status).toBe(400);
    }
  );
});
