/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { Client, generateId, TenantId, UserId } from "pagopa-interop-models";
import { generateToken, getMockClient } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { authorizationApi } from "pagopa-interop-api-clients";
import { api, authorizationService } from "../vitest.api.setup.js";
import { clientToApiClient } from "../../src/model/domain/apiConverter.js";

describe("API /clients authorization test", () => {
  const consumerId = generateId<TenantId>();
  const userId1: UserId = generateId();
  const userId2: UserId = generateId();

  const client1: Client = {
    ...getMockClient(),
    name: "client1",
    consumerId,
    users: [userId1],
    kind: "Consumer",
  };

  const client2: Client = {
    ...getMockClient(),
    name: "client2",
    consumerId,
    users: [userId2],
    kind: "Consumer",
  };

  const clientsResponse = {
    results: [client1, client2],
    totalCount: 2,
  };

  const apiClients = authorizationApi.Clients.parse({
    results: clientsResponse.results.map((client) =>
      clientToApiClient(client, { showUsers: false })
    ),
    totalCount: clientsResponse.totalCount,
  });

  authorizationService.getClients = vi.fn().mockResolvedValue(clientsResponse);

  const makeRequest = async (token: string) =>
    request(api)
      .get(`/clients`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query({
        consumerId,
        userIds: [userId1, userId2],
        offset: 0,
        limit: 50,
      });

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
      const res = await makeRequest(token);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiClients);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 400 for invalid query parameter (invalid limit)", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await request(api)
      .get("/clients")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query({
        consumerId,
        offset: 0,
        limit: 100,
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("title", "Bad request");
  });
});
