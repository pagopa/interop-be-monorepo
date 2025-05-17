/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { Client, ClientId, generateId } from "pagopa-interop-models";
import { generateToken, getMockClient } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { authorizationApi } from "pagopa-interop-api-clients";
import { api, authorizationService } from "../vitest.api.setup.js";
import { clientToApiClient } from "../../src/model/domain/apiConverter.js";
import {
  clientKeyNotFound,
  clientNotFound,
} from "../../src/model/domain/errors.js";

describe("API /clients/{clientId}/keys/{keyId}/bundle authorization test", () => {
  const clientId: ClientId = generateId();
  const keyId = "mock-kid-123";

  const mockClient: Client = {
    ...getMockClient(),
    id: clientId,
  };

  const mockKey: authorizationApi.JWKKey = {
    kty: "rsa",
    kid: keyId,
  };

  const apiKeyWithClient = authorizationApi.KeyWithClient.parse({
    key: mockKey,
    client: clientToApiClient(mockClient, { showUsers: false }),
  });

  authorizationService.getKeyWithClientByKeyId = vi.fn().mockResolvedValue({
    key: mockKey,
    client: clientToApiClient(mockClient, { showUsers: false }),
  });

  const makeRequest = async (
    token: string,
    clientId: ClientId,
    keyId: string
  ) =>
    request(api)
      .get(`/clients/${clientId}/keys/${keyId}/bundle`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.SECURITY_ROLE,
    authRole.M2M_ROLE,
    authRole.SUPPORT_ROLE,
  ];

  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, clientId, keyId);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiKeyWithClient);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, clientId, keyId);
    expect(res.status).toBe(403);
  });

  it.each([
    {
      error: clientNotFound(mockClient.id),
      expectedStatus: 404,
      clientId: mockClient.id,
    },
    {
      error: clientKeyNotFound(generateId(), mockClient.id),
      expectedStatus: 404,
      clientId: mockClient.id,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus, clientId }) => {
      if (error) {
        authorizationService.getKeyWithClientByKeyId = vi
          .fn()
          .mockRejectedValue(error);
      }

      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, clientId, mockKey.kid);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([{}, { clientId: "invalidId" }])(
    "Should return 400 if passed invalid params: %s",
    async ({ clientId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, clientId as ClientId, mockKey.kid);

      expect(res.status).toBe(400);
    }
  );
});
