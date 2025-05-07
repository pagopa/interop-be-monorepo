/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import {
  Client,
  generateId,
  invalidKeyLength,
  invalidPublicKey,
  jwkDecodingError,
  notAllowedCertificateException,
  notAllowedMultipleKeysException,
  notAllowedPrivateKeyException,
  notAnRSAKey,
  TenantId,
  UserId,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockClient,
  getMockKey,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { authorizationApi } from "pagopa-interop-api-clients";
import { api, authorizationService } from "../vitest.api.setup.js";
import { keyToApiKey } from "../../src/model/domain/apiConverter.js";
import {
  clientNotFound,
  keyAlreadyExists,
  organizationNotAllowedOnClient,
  tooManyKeysPerClient,
  userNotFound,
  userWithoutSecurityPrivileges,
} from "../../src/model/domain/errors.js";

describe("API /clients/{clientId}/keys authorization test", () => {
  const consumerId: TenantId = generateId();
  const userId: UserId = generateId();

  const keySeed: authorizationApi.KeySeed = {
    name: "key seed",
    use: "ENC",
    key: `MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAsFakePem`,
    alg: "",
  };

  const mockClient: Client = {
    ...getMockClient(),
    users: [userId],
    consumerId,
  };

  const key = getMockKey();

  const apiKey = keyToApiKey(key);

  authorizationService.createKey = vi.fn().mockResolvedValue(key);

  const makeRequest = async (token: string, clientId: string) =>
    request(api)
      .post(`/clients/${clientId}/keys`)
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
      const res = await makeRequest(token, mockClient.id);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiKey);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockClient.id);
    expect(res.status).toBe(403);
  });

  it("Should return 404 for clientNotFound", async () => {
    authorizationService.createKey = vi
      .fn()
      .mockRejectedValue(clientNotFound(mockClient.id));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockClient.id);
    expect(res.status).toBe(404);
  });

  it("Should return 400 for tooManyKeysPerClient", async () => {
    authorizationService.createKey = vi
      .fn()
      .mockRejectedValue(tooManyKeysPerClient(mockClient.id, 1));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockClient.id);
    expect(res.status).toBe(400);
  });

  it("Should return 400 for notAllowedPrivateKeyException", async () => {
    authorizationService.createKey = vi
      .fn()
      .mockRejectedValue(notAllowedPrivateKeyException());
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockClient.id);
    expect(res.status).toBe(400);
  });

  it("Should return 400 for notAllowedCertificateException", async () => {
    authorizationService.createKey = vi
      .fn()
      .mockRejectedValue(notAllowedCertificateException());
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockClient.id);
    expect(res.status).toBe(400);
  });

  it("Should return 400 for notAllowedMultipleKeysException", async () => {
    authorizationService.createKey = vi
      .fn()
      .mockRejectedValue(notAllowedMultipleKeysException());
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockClient.id);
    expect(res.status).toBe(400);
  });

  it("Should return 400 for jwkDecodingError", async () => {
    authorizationService.createKey = vi
      .fn()
      .mockRejectedValue(jwkDecodingError(""));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockClient.id);
    expect(res.status).toBe(400);
  });

  it("Should return 400 for invalidPublicKey", async () => {
    authorizationService.createKey = vi
      .fn()
      .mockRejectedValue(invalidPublicKey());
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockClient.id);
    expect(res.status).toBe(400);
  });

  it("Should return 400 for notAnRSAKey", async () => {
    authorizationService.createKey = vi.fn().mockRejectedValue(notAnRSAKey());
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockClient.id);
    expect(res.status).toBe(400);
  });

  it("Should return 400 for invalidKeyLength", async () => {
    authorizationService.createKey = vi
      .fn()
      .mockRejectedValue(invalidKeyLength(key.encodedPem.length));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockClient.id);
    expect(res.status).toBe(400);
  });

  it("Should return 400 if passed an invalid field", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid");
    expect(res.status).toBe(400);
  });

  it("Should return 409 for invalidKeyLength", async () => {
    authorizationService.createKey = vi
      .fn()
      .mockRejectedValue(keyAlreadyExists(key.kid));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockClient.id);
    expect(res.status).toBe(409);
  });

  it("Should return 403 for organizationNotAllowedOnClient", async () => {
    authorizationService.createKey = vi
      .fn()
      .mockRejectedValue(
        organizationNotAllowedOnClient(generateId(), mockClient.id)
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockClient.id);
    expect(res.status).toBe(403);
  });

  it("Should return 403 for userWithoutSecurityPrivileges", async () => {
    authorizationService.createKey = vi
      .fn()
      .mockRejectedValue(userWithoutSecurityPrivileges(generateId(), userId));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockClient.id);
    expect(res.status).toBe(403);
  });

  it("Should return 403 for userNotFound", async () => {
    authorizationService.createKey = vi
      .fn()
      .mockRejectedValue(userNotFound(userId, generateId()));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockClient.id);
    expect(res.status).toBe(403);
  });
});
