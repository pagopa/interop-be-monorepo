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
      .mockResolvedValue(mockClient);
  });

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(apiResponse);
  });

  it.each(
    Object.values(authRole).filter((role) => role !== authRole.ADMIN_ROLE)
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 404 for clientNotFound", async () => {
    authorizationService.setAdminToClient = vi
      .fn()
      .mockRejectedValue(clientNotFound(generateId()));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 403 for clientKindNotAllowed", async () => {
    authorizationService.setAdminToClient = vi
      .fn()
      .mockRejectedValue(clientKindNotAllowed(mockClient.id));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });
  it("Should return 403 for userWithoutSecurityPrivileges", async () => {
    authorizationService.setAdminToClient = vi
      .fn()
      .mockRejectedValue(
        userWithoutSecurityPrivileges(
          generateId<TenantId>(),
          generateId<UserId>()
        )
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });
  it("Should return 409 for userAlreadyClientAdmin", async () => {
    authorizationService.setAdminToClient = vi
      .fn()
      .mockRejectedValue(
        clientAdminAlreadyAssignedToUser(mockClient.id, body.adminId)
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(409);
  });
});
