/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  generateToken,
  getMockClient,
  mockTokenOrganizationId,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import {
  ClientId,
  clientKind,
  generateId,
  TenantId,
  UserId,
} from "pagopa-interop-models";
import { api, authorizationService } from "../vitest.api.setup.js";
import {
  clientAdminAlreadyAssignedToUser,
  clientKindNotAllowed,
  clientNotFound,
  userWithoutSecurityPrivileges,
} from "../../src/model/domain/errors.js";
import { testToFullClient } from "../apiUtils.js";

describe("API POST /clients/{clientId}/admin test", () => {
  const mockClient = getMockClient({
    kind: clientKind.api,
    consumerId: mockTokenOrganizationId,
  });
  const adminSeed = generateId<UserId>();
  const makeRequest = async (
    token: string,
    clientId: ClientId = mockClient.id,
    adminId: UserId = adminSeed
  ) =>
    request(api)
      .post(`/clients/${clientId}/admin`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send({ adminId });

  beforeEach(() => {
    authorizationService.setAdminToClient = vi
      .fn()
      .mockResolvedValue(mockClient);
  });

  const authorizedRoles: AuthRole[] = [authRole.ADMIN_ROLE];

  it.each(authorizedRoles)(
    "Should return 200 with a full client for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, mockClient.id, adminSeed);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(testToFullClient(mockClient));
    }
  );

  it.each([
    {
      clientId: "invalid-client-id",
      adminId: generateId<UserId>(),
    },
    { clientId: mockClient.id, adminId: {} },
    {
      clientId: mockClient.id,
      adminId: 123,
    },
    {
      clientId: mockClient.id,
      adminId: "",
    },
    {
      clientId: mockClient.id,
      adminId: "foo",
    },
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

  it.each([
    { error: clientNotFound(generateId()), expectedStatus: 404 },
    { error: clientKindNotAllowed(mockClient.id), expectedStatus: 403 },
    {
      error: userWithoutSecurityPrivileges(
        generateId<TenantId>(),
        generateId<UserId>()
      ),
      expectedStatus: 403,
    },
    {
      error: clientAdminAlreadyAssignedToUser(
        mockClient.id,
        generateId<UserId>()
      ),
      expectedStatus: 409,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      authorizationService.setAdminToClient = vi.fn().mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => role !== authRole.ADMIN_ROLE)
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });
});
