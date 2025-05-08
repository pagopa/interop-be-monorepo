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

  const makeRequest = async (token: string, producerKeychainId: string) =>
    request(api)
      .post(`/producerKeychains/${producerKeychainId}/keys`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(keySeed);

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

  it("Should return 404 for producerKeychainNotFound", async () => {
    authorizationService.createProducerKeychainKey = vi
      .fn()
      .mockRejectedValue(producerKeychainNotFound(mockProducerKeychain.id));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockProducerKeychain.id);
    expect(res.status).toBe(404);
  });

  it("Should return 400 for tooManyKeysPerProducerKeychain", async () => {
    authorizationService.createProducerKeychainKey = vi
      .fn()
      .mockRejectedValue(
        tooManyKeysPerProducerKeychain(mockProducerKeychain.id, 1)
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockProducerKeychain.id);
    expect(res.status).toBe(400);
  });

  it("Should return 400 for invalidPublicKey", async () => {
    authorizationService.createProducerKeychainKey = vi
      .fn()
      .mockRejectedValue(invalidPublicKey());
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockProducerKeychain.id);
    expect(res.status).toBe(400);
  });

  it("Should return 400 for notAnRSAKey", async () => {
    authorizationService.createProducerKeychainKey = vi
      .fn()
      .mockRejectedValue(notAnRSAKey());
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockProducerKeychain.id);
    expect(res.status).toBe(400);
  });

  it("Should return 400 for invalidKeyLength", async () => {
    authorizationService.createProducerKeychainKey = vi
      .fn()
      .mockRejectedValue(invalidKeyLength(mockKey.encodedPem.length));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockProducerKeychain.id);
    expect(res.status).toBe(400);
  });

  it("Should return 400 if passed an invalid field", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid");
    expect(res.status).toBe(400);
  });

  it("Should return 403 for organizationNotAllowedOnProducerKeychain", async () => {
    authorizationService.createProducerKeychainKey = vi
      .fn()
      .mockRejectedValue(
        organizationNotAllowedOnProducerKeychain(
          generateId(),
          mockProducerKeychain.id
        )
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockProducerKeychain.id);
    expect(res.status).toBe(403);
  });
});
