/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import {
  Client,
  generateId,
  Key,
  unsafeBrandId,
  UserId,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockClient,
  getMockKey,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { authorizationApi } from "pagopa-interop-api-clients";
import { api, authorizationService } from "../vitest.api.setup.js";
import {
  clientNotFound,
  organizationNotAllowedOnClient,
  securityUserNotMember,
} from "../../src/model/domain/errors.js";
import { keyToApiKey } from "../../src/model/domain/apiConverter.js";

describe("API /clients/{clientId}/keys authorization test", () => {
  const consumerId = generateId();
  const mockKey = getMockKey();
  const mockClient: Client = {
    ...getMockClient(),
    keys: [mockKey],
    consumerId: unsafeBrandId(consumerId),
  };

  const keyUserId1: UserId = generateId();
  const keyUserId2: UserId = generateId();
  const keyUserId3: UserId = generateId();

  const keyWithUser1: Key = {
    ...mockKey,
    userId: keyUserId1,
  };
  const keyWithUser2: Key = {
    ...mockKey,
    userId: keyUserId2,
  };
  const keyWithUser3: Key = {
    ...mockKey,
    userId: keyUserId3,
  };
  const clientWithKeyUser: Client = {
    ...mockClient,
    keys: [keyWithUser1, keyWithUser2, keyWithUser3],
    users: [keyUserId1, keyUserId2, keyUserId3],
  };

  const apiKeys = authorizationApi.Keys.parse({
    keys: clientWithKeyUser.keys.map((key) => keyToApiKey(key)),
    totalCount: 3,
  });

  authorizationService.getClientKeys = vi.fn().mockResolvedValue({
    results: [keyWithUser1, keyWithUser2, keyWithUser3],
    totalCount: 3,
  });

  const queryParams = {
    offset: 0,
    limit: 50,
    userIds: [keyUserId1, keyUserId2, keyUserId3],
  };

  const makeRequest = async (
    token: string,
    clientId: string,
    query: typeof queryParams = queryParams
  ) =>
    request(api)
      .get(`/clients/${clientId}/keys`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query(query);

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
      const res = await makeRequest(token, clientWithKeyUser.id);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiKeys);
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
      name: "clientNotFound",
      error: clientNotFound(clientWithKeyUser.id),
      expectedStatus: 404,
      clientId: generateId(),
    },
    {
      name: "organizationNotAllowedOnClient",
      error: organizationNotAllowedOnClient(generateId(), mockClient.id),
      expectedStatus: 403,
      clientId: mockClient.id,
    },
    {
      name: "securityUserNotMember",
      error: securityUserNotMember(keyUserId1),
      expectedStatus: 403,
      clientId: mockClient.id,
    },
    {
      name: "invalid parameter clientId",
      error: null,
      expectedStatus: 400,
      clientId: "invalid",
    },
  ])(
    "Should return $expectedStatus for $name",
    async ({ error, expectedStatus, clientId }) => {
      authorizationService.getClientKeys = vi.fn().mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, clientId);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    {},
    { ...queryParams, offset: "invalid" },
    { ...queryParams, limit: "invalid" },
    { ...queryParams, offset: -2 },
    { ...queryParams, limit: 100 },
  ])("Should return 400 if passed invalid params", async (query) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(
      token,
      mockClient.id,
      query as typeof queryParams
    );

    expect(res.status).toBe(400);
  });
});
