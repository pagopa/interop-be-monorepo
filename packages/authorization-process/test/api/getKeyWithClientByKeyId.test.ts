/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { JsonWebKey } from "crypto";
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { Client, ClientId, Key, generateId } from "pagopa-interop-models";
import {
  generateToken,
  getMockClient,
  getMockKey,
  mockTokenOrganizationId,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { api, authorizationService } from "../vitest.api.setup.js";
import {
  clientKeyNotFound,
  clientNotFound,
} from "../../src/model/domain/errors.js";
import { testToPartialClient, testToFullClient } from "../apiUtils.js";

describe("API /clients/{clientId}/keys/{keyId}/bundle authorization test", () => {
  const mockClient: Client = getMockClient();
  const mockKey: Key = getMockKey();

  const mockJwk: JsonWebKey = {
    kty: "RSA",
    n: "testtesttesttest",
    e: "test",
  };
  authorizationService.getKeyWithClientByKeyId = vi.fn().mockResolvedValue({
    jwk: mockJwk,
    kid: mockKey.kid,
    client: mockClient,
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
    "Should return 200 with a partial client for user with role %s and tenant != client consumerId",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, mockClient.id, mockKey.kid);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        client: testToPartialClient(mockClient),
        key: {
          ...mockJwk,
          kid: mockKey.kid,
          use: "sig",
        },
      });
    }
  );

  it.each(authorizedRoles)(
    "Should return 200 with a full client for user with role %s and tenant = client consumerId",
    async (role) => {
      const mockClient = getMockClient({
        consumerId: mockTokenOrganizationId,
      });
      authorizationService.getKeyWithClientByKeyId = vi
        .fn()
        .mockResolvedValueOnce({
          jwk: mockJwk,
          kid: mockKey.kid,
          client: mockClient,
        });
      const token = generateToken(role);
      const res = await makeRequest(token, mockClient.id, mockKey.kid);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        client: testToFullClient(mockClient),
        key: {
          ...mockJwk,
          kid: mockKey.kid,
          use: "sig",
        },
      });
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockClient.id, mockKey.kid);
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
