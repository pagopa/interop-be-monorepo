/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateToken, getMockClient } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { generateId, TenantId, UserId } from "pagopa-interop-models";
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
  const body = { adminId: generateId<UserId>() };
  const makeRequest = async (token: string, clientId: string = mockClient.id) =>
    request(api)
      .post(`/clients/${clientId}/admin`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  const apiResponse = authorizationApi.Client.parse(
    clientToApiClient(mockClient, { showUsers: false })
  );

  beforeEach(() => {
    authorizationService.setAdminToClient = vi
      .fn()
      .mockResolvedValue({ client: mockClient, showUsers: false });
  });

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(apiResponse);
  });

  it.each([
    {
      description: "invalid clientId",
      clientId: "invalid-client-id",
      body,
    },
    { description: "invalid body: {}", clientId: mockClient.id, body: {} },
    {
      description: "invalid body: { adminId: 123 }",
      clientId: mockClient.id,
      body: { adminId: 123 },
    },
    {
      description: "invalid body: { adminId: '' }",
      clientId: mockClient.id,
      body: { adminId: "" },
    },
    {
      description: "invalid body: { invalidField: 'foo' }",
      clientId: mockClient.id,
      body: { invalidField: "foo" },
    },
  ])(
    "Should return 400 if passed an $description",
    async ({ clientId, body }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await request(api)
        .post(`/clients/${clientId}/admin`)
        .set("Authorization", `Bearer ${token}`)
        .set("X-Correlation-Id", generateId())
        .send(body);
      expect(res.status).toBe(400);
    }
  );

  it.each([
    [clientNotFound(generateId()), 404],
    [clientKindNotAllowed(mockClient.id), 403],
    [
      userWithoutSecurityPrivileges(
        generateId<TenantId>(),
        generateId<UserId>()
      ),
      403,
    ],
    [clientAdminAlreadyAssignedToUser(mockClient.id, body.adminId), 409],
  ])("Should return %j for status %i", async (error, expectedStatus) => {
    authorizationService.setAdminToClient = vi.fn().mockRejectedValue(error);
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(expectedStatus);
  });

  it.each(
    Object.values(authRole).filter((role) => role !== authRole.ADMIN_ROLE)
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });
});
