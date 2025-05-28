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
    ...getMockKey(),
    userId: keyUserId1,
  };
  const keyWithUser2: Key = {
    ...getMockKey(),
    userId: keyUserId2,
  };
  const keyWithUser3: Key = {
    ...getMockKey(),
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

  authorizationService.getProducerKeychainKeys = vi
    .fn()
    .mockResolvedValue([keyWithUser1, keyWithUser2, keyWithUser3]);

  const makeRequest = async (
    token: string,
    producerKeychainId: ProducerKeychainId
  ) =>
    request(api)
      .get(`/producerKeychains/${producerKeychainId}/keys`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query({
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
      const res = await makeRequest(token, producerKeychainWithKeyUser.id);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiKeys);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, producerKeychainWithKeyUser.id);
    expect(res.status).toBe(403);
  });

  it.each([
    {
      error: producerKeychainNotFound(mockProducerKeychain.id),
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
      if (error) {
        authorizationService.getProducerKeychainKeys = vi
          .fn()
          .mockRejectedValue(error);
      }

      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, mockProducerKeychain.id);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([{}, { producerKeychainId: "invalidId" }])(
    "Should return 400 if passed invalid params: %s",
    async ({ producerKeychainId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        producerKeychainId as ProducerKeychainId
      );

      expect(res.status).toBe(400);
    }
  );
});
