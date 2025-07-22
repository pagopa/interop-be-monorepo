/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import {
  Client,
  generateId,
  PurposeId,
  TenantId,
  UserId,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockClient,
  mockTokenOrganizationId,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { api, authorizationService } from "../vitest.api.setup.js";
import { testToPartialClient, testToFullClient } from "../apiUtils.js";

describe("API /clients authorization test", () => {
  const consumerId = generateId<TenantId>();
  const purposeId = generateId<PurposeId>();
  const userId1: UserId = generateId();
  const userId2: UserId = generateId();

  const client1: Client = {
    ...getMockClient(),
    name: "client",
    consumerId: mockTokenOrganizationId,
    purposes: [purposeId],
    users: [userId1],
    kind: "Consumer",
  };

  const client2: Client = {
    ...getMockClient(),
    name: "client",
    consumerId,
    purposes: [purposeId],
    users: [userId2],
    kind: "Consumer",
  };

  const clientsResponse = {
    results: [client1, client2],
    totalCount: 2,
  };

  authorizationService.getClients = vi.fn().mockResolvedValue(clientsResponse);

  const queryParams = {
    name: "client",
    userIds: [userId1, userId2],
    purposes: [purposeId],
    consumerId,
    kind: "CONSUMER",
    offset: 0,
    limit: 50,
  };

  const makeRequest = async (
    token: string,
    query: typeof queryParams = queryParams
  ) =>
    request(api)
      .get(`/clients`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query(query);

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.SECURITY_ROLE,
    authRole.M2M_ROLE,
    authRole.SUPPORT_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];

  it.each(authorizedRoles)(
    "Should return 200 with role %s and return full or partial clients based on client consumerId",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        results: [testToFullClient(client1), testToPartialClient(client2)],
        totalCount: 2,
      });
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it.each([
    {},
    { ...queryParams, offset: "invalid" },
    { ...queryParams, limit: "invalid" },
    { ...queryParams, consumerId: "invalid-consumer-id" },
    { ...queryParams, kind: "invalidKind" },
    { ...queryParams, offset: -2 },
    { ...queryParams, limit: 100 },
  ])("Should return 400 if passed invalid params: %s", async (query) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, query as typeof queryParams);

    expect(res.status).toBe(400);
  });
});
