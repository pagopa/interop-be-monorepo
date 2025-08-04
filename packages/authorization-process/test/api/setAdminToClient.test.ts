/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateToken, getMockClient } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { ClientId, generateId, TenantId, UserId } from "pagopa-interop-models";
import { authorizationApi } from "pagopa-interop-api-clients";
import { api, authorizationService } from "../vitest.api.setup.js";
import { clientToApiClient } from "../../src/model/domain/apiConverter.js";
import {
  clientAdminAlreadyAssignedToUser,
  clientKindNotAllowed,
  clientNotFound,
  userWithoutSecurityPrivileges,
} from "../../src/model/domain/errors.js";

describe("API POST /clients/{clientId}/admin test", () => {
  const mockClient = getMockClient();
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

  const apiResponse = authorizationApi.Client.parse(
    clientToApiClient(mockClient, { showUsers: false })
  );

  beforeEach(() => {
    authorizationService.setAdminToClient = vi
      .fn()
      .mockResolvedValue({ client: mockClient, showUsers: true });
  });

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(apiResponse);
  });

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
