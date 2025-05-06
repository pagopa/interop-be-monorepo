/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { generateId, ProducerKeychain, UserId } from "pagopa-interop-models";
import {
  generateToken,
  getMockProducerKeychain,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { api, authorizationService } from "../vitest.api.setup.js";

describe("API /producerKeychains/{producerKeychainId}/users/{userId} authorization test", () => {
  const userIdToRemove: UserId = generateId();
  const userIdToNotRemove: UserId = generateId();

  const mockProducerKeychain: ProducerKeychain = {
    ...getMockProducerKeychain(),
    users: [userIdToRemove, userIdToNotRemove],
  };
  const makeRequest = async (
    token: string,
    producerKeychainId: string,
    userId: string
  ) =>
    request(api)
      .delete(`/producerKeychains/${producerKeychainId}/users/${userId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  const authorizedRoles: AuthRole[] = [authRole.ADMIN_ROLE];

  authorizationService.removeProducerKeychainUser = vi
    .fn()
    .mockResolvedValue({});

  it.each(authorizedRoles)(
    "Should return 204 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(
        token,
        mockProducerKeychain.id,
        userIdToRemove
      );
      expect(res.status).toBe(204);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(
      token,
      mockProducerKeychain.id,
      userIdToRemove
    );
    expect(res.status).toBe(403);
  });
});
