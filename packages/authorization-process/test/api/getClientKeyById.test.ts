/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { Client, ClientId, generateId } from "pagopa-interop-models";
import {
  generateToken,
  getMockClient,
  getMockKey,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { keyToApiKey } from "../../src/model/domain/apiConverter.js";
import { api, authorizationService } from "../vitest.api.setup.js";
import {
  clientKeyNotFound,
  clientNotFound,
  tenantNotAllowedOnClient,
  securityUserNotMember,
} from "../../src/model/domain/errors.js";

describe("API /clients/{clientId}/keys/{keyId} authorization test", () => {
  const mockKey1 = getMockKey();
  const mockKey2 = getMockKey();
  const mockClient: Client = {
    ...getMockClient(),
    consumerId: generateId(),
    keys: [mockKey1, mockKey2],
  };

  const apiKey = keyToApiKey(mockKey1);

  authorizationService.getClientKeyById = vi.fn().mockResolvedValue(mockKey1);

  const makeRequest = async (
    token: string,
    clientId: ClientId,
    keyId: string
  ) =>
    request(api)
      .get(`/clients/${clientId}/keys/${keyId}`)
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
      const res = await makeRequest(token, mockClient.id, mockKey1.kid);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiKey);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockClient.id, mockKey1.kid);

    expect(res.status).toBe(403);
  });

  it.each([
    {
      error: clientKeyNotFound(mockKey1.kid, mockClient.id),
      expectedStatus: 404,
    },
    {
      error: clientNotFound(mockClient.id),
      expectedStatus: 404,
    },
    {
      error: tenantNotAllowedOnClient(generateId(), mockClient.id),
      expectedStatus: 403,
    },
    {
      error: securityUserNotMember(mockClient.users[0]),
      expectedStatus: 403,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      authorizationService.getClientKeyById = vi.fn().mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, mockClient.id, mockKey1.kid);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([{}, { clientId: "invalidId", keyId: mockKey1.kid }])(
    "Should return 400 if passed invalid params: %s",
    async ({ clientId, keyId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        clientId as ClientId,
        keyId as string
      );

      expect(res.status).toBe(400);
    }
  );
});
