/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import {
  generateId,
  Key,
  ProducerKeychain,
  ProducerKeychainId,
  TenantId,
  unsafeBrandId,
  UserId,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockKey,
  getMockProducerKeychain,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { authorizationApi } from "pagopa-interop-api-clients";
import { api, authorizationService } from "../vitest.api.setup.js";
import { keyToApiKey } from "../../src/model/domain/apiConverter.js";
import {
  tenantNotAllowedOnProducerKeychain,
  producerKeychainNotFound,
} from "../../src/model/domain/errors.js";

describe("API /producerKeychains/{producerKeychainId}/keys authorization test", () => {
  const producerId = generateId<TenantId>();
  const mockKey = getMockKey();
  const mockProducerKeychain: ProducerKeychain = {
    ...getMockProducerKeychain(),
    keys: [mockKey],
    producerId: unsafeBrandId(producerId),
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

  const producerKeychainWithKeyUser: ProducerKeychain = {
    ...mockProducerKeychain,
    keys: [keyWithUser1, keyWithUser2, keyWithUser3],
    users: [keyUserId1, keyUserId2, keyUserId3],
  };

  const apiKeys = authorizationApi.Keys.parse({
    keys: producerKeychainWithKeyUser.keys.map((key) => keyToApiKey(key)),
    totalCount: 3,
  });

  authorizationService.getProducerKeychainKeys = vi.fn().mockResolvedValue({
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
    producerKeychainId: ProducerKeychainId,
    query: typeof queryParams = queryParams
  ) =>
    request(api)
      .get(`/producerKeychains/${producerKeychainId}/keys`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query(query);

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.SECURITY_ROLE,
    authRole.M2M_ROLE,
    authRole.M2M_ADMIN_ROLE,
    authRole.SUPPORT_ROLE,
  ];

  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, producerKeychainWithKeyUser.id);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiKeys);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockProducerKeychain.id);
    expect(res.status).toBe(403);
  });

  it.each([
    {
      error: producerKeychainNotFound(producerKeychainWithKeyUser.id),
      expectedStatus: 404,
    },
    {
      error: tenantNotAllowedOnProducerKeychain(
        generateId(),
        mockProducerKeychain.id
      ),
      expectedStatus: 403,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      authorizationService.getProducerKeychainKeys = vi
        .fn()
        .mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, mockProducerKeychain.id);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    [{}, mockProducerKeychain.id],
    [{ ...queryParams, offset: "invalid" }, mockProducerKeychain.id],
    [{ ...queryParams, limit: "invalid" }, mockProducerKeychain.id],
    [{ ...queryParams, offset: -2 }, mockProducerKeychain.id],
    [{ ...queryParams, limit: 100 }, mockProducerKeychain.id],
    [{ ...queryParams }, "invalid"],
  ])(
    "Should return 400 if passed invalid params: %s (producerKeychainId: %s)",
    async (query, producerKeychainId) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        producerKeychainId as ProducerKeychainId,
        query as typeof queryParams
      );

      expect(res.status).toBe(400);
    }
  );
});
