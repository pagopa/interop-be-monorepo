/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { generateId, ProducerKeychain, UserId } from "pagopa-interop-models";
import {
  generateToken,
  getMockProducerKeychain,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { authorizationApi } from "pagopa-interop-api-clients";
import { api, authorizationService } from "../vitest.api.setup.js";

describe("API /producerKeychains/{producerKeychainId}/users authorization test", () => {
  const userId1: UserId = generateId();
  const userId2: UserId = generateId();
  const mockProducerKeychain: ProducerKeychain = {
    ...getMockProducerKeychain(),
    name: "test",
    users: [userId1, userId2],
  };

  const apiProducerKeychainUsers = authorizationApi.Users.parse([
    userId1,
    userId2,
  ]);

  authorizationService.getProducerKeychainUsers = vi
    .fn()
    .mockResolvedValue([userId1, userId2]);

  const makeRequest = async (token: string, producerKeychainId: string) =>
    request(api)
      .get(`/producerKeychains/${producerKeychainId}/users`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query({
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
      const res = await makeRequest(token, mockProducerKeychain.id);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiProducerKeychainUsers);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockProducerKeychain.id);
    expect(res.status).toBe(403);
  });
});
