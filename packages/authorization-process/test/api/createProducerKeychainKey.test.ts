/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import {
  generateId,
  invalidKeyLength,
  invalidPublicKey,
  notAnRSAKey,
  ProducerKeychain,
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
  organizationNotAllowedOnProducerKeychain,
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
    producerKeychainId: string,
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
      name: "producerKeychainNotFound",
      error: producerKeychainNotFound(mockProducerKeychain.id),
      expectedStatus: 404,
    },
    {
      name: "tooManyKeysPerProducerKeychain",
      error: tooManyKeysPerProducerKeychain(mockProducerKeychain.id, 1),
      expectedStatus: 400,
    },
    {
      name: "invalidPublicKey",
      error: invalidPublicKey(),
      expectedStatus: 400,
    },
    {
      name: "notAnRSAKey",
      error: notAnRSAKey(),
      expectedStatus: 400,
    },
    {
      name: "invalidKeyLength",
      error: invalidKeyLength(mockKey.encodedPem.length),
      expectedStatus: 400,
    },
    {
      name: "organizationNotAllowedOnProducerKeychain",
      error: organizationNotAllowedOnProducerKeychain(
        generateId(),
        mockProducerKeychain.id
      ),
      expectedStatus: 403,
    },
  ])(
    "Should return $expectedStatus for $name",
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
    {},
    { ...keySeed, invalidParam: "invalidValue" },
    { ...keySeed, name: 1 },
    { ...keySeed, use: "invalidUse" },
    { ...keySeed, alg: 1 },
    { ...keySeed, key: 1 },
    { ...keySeed, name: undefined },
    { ...keySeed, use: undefined },
    { ...keySeed, alg: undefined },
    { ...keySeed, key: undefined },
  ])("Should return 400 if passed invalid params", async (body) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(
      token,
      mockProducerKeychain.id,
      body as authorizationApi.KeySeed
    );

    expect(res.status).toBe(400);
  });
});
