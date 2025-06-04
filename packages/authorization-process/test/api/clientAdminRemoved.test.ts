/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import { ClientId, generateId, UserId } from "pagopa-interop-models";
import { generateToken, getMockClient } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, authorizationService } from "../vitest.api.setup.js";
import {
  clientAdminIdNotFound,
  clientKindNotAllowed,
  clientNotFound,
  tenantNotAllowedOnClient,
} from "../../src/model/domain/errors.js";

describe("API /clients/{clientId}/admin/{adminId} authorization test", () => {
  const mockClient = { ...getMockClient(), adminId: generateId<UserId>() };

  authorizationService.removeClientAdmin = vi.fn().mockResolvedValue({});

  const makeRequest = async (
    token: string,
    clientId: ClientId,
    adminId: UserId
  ) =>
    request(api)
      .delete(`/clients/${clientId}/admin/${adminId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  const authorizedRoles: AuthRole[] = [authRole.ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 204 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, mockClient.id, mockClient.adminId);
      expect(res.status).toBe(204);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockClient.id, mockClient.adminId);
    expect(res.status).toBe(403);
  });

  it.each([
    {
      error: clientNotFound(mockClient.id),
      expectedStatus: 404,
    },
    {
      error: clientKindNotAllowed(mockClient.id),
      expectedStatus: 403,
    },
    {
      error: tenantNotAllowedOnClient(generateId(), mockClient.id),
      expectedStatus: 403,
    },
    {
      error: clientAdminIdNotFound(mockClient.id, mockClient.adminId),
      expectedStatus: 400,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      authorizationService.removeClientAdmin = vi.fn().mockRejectedValue(error);

      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, mockClient.id, mockClient.adminId);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    {},
    { clientId: "invalidId", adminId: mockClient.adminId },
    { clientId: mockClient.id, adminId: "invalidId" },
  ])(
    "Should return 400 if passed invalid params: %s",
    async ({ clientId, adminId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        clientId as ClientId,
        adminId as UserId
      );

      expect(res.status).toBe(400);
    }
  );
});
