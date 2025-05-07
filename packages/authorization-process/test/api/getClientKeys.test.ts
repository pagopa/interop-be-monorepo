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

  const makeRequest = async (token: string, clientId: string) =>
    request(api)
      .get(`/clients/${clientId}/keys`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query({
        offset: 0,
        limit: 50,
        userIds: [keyUserId1, keyUserId2, keyUserId3],
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

  it("Should return 404 for clientNotFound", async () => {
    authorizationService.getClientKeys = vi
      .fn()
      .mockRejectedValue(clientNotFound(clientWithKeyUser.id));

    const res = await makeRequest(
      generateToken(authRole.ADMIN_ROLE),
      generateId()
    );

    expect(res.status).toBe(404);
  });

  it("Should return 403 for organizationNotAllowedOnClient", async () => {
    authorizationService.getClientKeys = vi
      .fn()
      .mockRejectedValue(
        organizationNotAllowedOnClient(generateId(), mockClient.id)
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockClient.id);
    expect(res.status).toBe(403);
  });

  it("Should return 403 for securityUserNotMember", async () => {
    authorizationService.getClientKeys = vi
      .fn()
      .mockRejectedValue(securityUserNotMember(keyUserId1));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockClient.id);
    expect(res.status).toBe(403);
  });

  it("Should return 400 if passed an invalid field", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid");
    expect(res.status).toBe(400);
  });
});
