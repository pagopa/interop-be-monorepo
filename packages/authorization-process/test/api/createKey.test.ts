/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import {
  Client,
  ClientId,
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
  tenantNotAllowedOnClient,
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

  const makeRequest = async (
    token: string,
    clientId: ClientId,
    body: authorizationApi.KeySeed = keySeed
  ) =>
    request(api)
      .post(`/clients/${clientId}/keys`)
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

  it.each([
    {
      error: clientNotFound(mockClient.id),
      expectedStatus: 404,
    },
    {
      error: tooManyKeysPerClient(mockClient.id, 1),
      expectedStatus: 400,
    },
    {
      error: notAllowedPrivateKeyException(),
      expectedStatus: 400,
    },
    {
      error: notAllowedCertificateException(),
      expectedStatus: 400,
    },
    {
      error: notAllowedMultipleKeysException(),
      expectedStatus: 400,
    },
    {
      error: jwkDecodingError(""),
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
      error: invalidKeyLength(key.encodedPem.length),
      expectedStatus: 400,
    },
    {
      error: keyAlreadyExists(key.kid),
      expectedStatus: 409,
    },
    {
      error: tenantNotAllowedOnClient(generateId(), mockClient.id),
      expectedStatus: 403,
    },
    {
      error: userWithoutSecurityPrivileges(generateId(), userId),
      expectedStatus: 403,
    },
    {
      error: userNotFound(userId, generateId()),
      expectedStatus: 403,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      authorizationService.createKey = vi.fn().mockRejectedValue(error);

      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, mockClient.id);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    [{}, mockClient.id],
    [{ ...keySeed, invalidParam: "invalidValue" }, mockClient.id],
    [{ ...keySeed, name: 1 }, mockClient.id],
    [{ ...keySeed, use: "invalidUse" }, mockClient.id],
    [{ ...keySeed, alg: 1 }, mockClient.id],
    [{ ...keySeed, key: 1 }, mockClient.id],
    [{ ...keySeed, name: undefined }, mockClient.id],
    [{ ...keySeed, use: undefined }, mockClient.id],
    [{ ...keySeed, alg: undefined }, mockClient.id],
    [{ ...keySeed, key: undefined }, mockClient.id],
    [{ ...keySeed }, "invalidId"],
  ])(
    "Should return 400 if passed invalid params: %s (clientId: %s)",
    async (body, clientId) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        clientId as ClientId,
        body as authorizationApi.KeySeed
      );

      expect(res.status).toBe(400);
    }
  );
});
