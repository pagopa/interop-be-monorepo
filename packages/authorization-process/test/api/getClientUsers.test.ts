/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { Client, ClientId, generateId, UserId } from "pagopa-interop-models";
import { generateToken, getMockClient } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { api, authorizationService } from "../vitest.api.setup.js";
import {
  clientNotFound,
  tenantNotAllowedOnClient,
} from "../../src/model/domain/errors.js";

describe("API /clients/{clientId}/users authorization test", () => {
  const userId1: UserId = generateId();
  const userId2: UserId = generateId();
  const mockClient: Client = {
    ...getMockClient(),
    users: [userId1, userId2],
  };

  const users = [userId1, userId2];
  authorizationService.getClientUsers = vi
    .fn()
    .mockResolvedValue([userId1, userId2]);

  const makeRequest = async (token: string, clientId: ClientId) =>
    request(api)
      .get(`/clients/${clientId}/users`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.SECURITY_ROLE,
    authRole.M2M_ROLE,
    authRole.SUPPORT_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];

  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, mockClient.id);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(users);
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
      clientId: mockClient.id,
    },
    {
      error: tenantNotAllowedOnClient(generateId(), mockClient.id),
      expectedStatus: 403,
      clientId: mockClient.id,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus, clientId }) => {
      if (error) {
        authorizationService.getClientUsers = vi.fn().mockRejectedValue(error);
      }

      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, clientId);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([{}, { clientId: "invalidId" }])(
    "Should return 400 if passed invalid params: %s",
    async ({ clientId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, clientId as ClientId);

      expect(res.status).toBe(400);
    }
  );
});
