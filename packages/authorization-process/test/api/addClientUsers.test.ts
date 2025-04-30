/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import { Client, generateId, TenantId, UserId } from "pagopa-interop-models";
import { generateToken, getMockClient } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, authorizationService } from "../vitest.api.setup.js";
import { clientToApiClient } from "../../src/model/domain/apiConverter.js";

describe("API /clients/{clientId}/users authorization test", () => {
  const consumerId: TenantId = generateId();
  const userIds: UserId[] = [generateId()];
  const usersToAdd: UserId[] = [generateId(), generateId()];

  const mockClient: Client = {
    ...getMockClient(),
    consumerId,
    users: userIds,
  };

  const apiClient = clientToApiClient(mockClient, { showUsers: true });

  authorizationService.addClientUsers = vi
    .fn()
    .mockResolvedValue({ client: mockClient, showUsers: true });

  const makeRequest = async (token: string, clientId: string) =>
    request(api)
      .post(`/clients/${clientId}/users`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send({ userIds: usersToAdd });

  const authorizedRoles: AuthRole[] = [authRole.ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, mockClient.id);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiClient);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockClient.id);
    expect(res.status).toBe(403);
  });

  it("Should return 404 not found", async () => {
    const res = await makeRequest(generateToken(authRole.ADMIN_ROLE), "");
    expect(res.status).toBe(404);
  });
});
