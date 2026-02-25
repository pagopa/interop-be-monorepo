/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import {
  generateId,
  ProducerKeychain,
  ProducerKeychainId,
  UserId,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockProducerKeychain,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { api, authorizationService } from "../vitest.api.setup.js";
import {
  tenantNotAllowedOnProducerKeychain,
  producerKeychainNotFound,
  producerKeychainUserIdNotFound,
} from "../../src/model/domain/errors.js";
import { testToFullProducerKeychain } from "../apiUtils.js";

describe("API /producerKeychains/{producerKeychainId}/users/{userId} authorization test", () => {
  const userIdToRemove: UserId = generateId();
  const userIdToNotRemove: UserId = generateId();

  const mockProducerKeychain: ProducerKeychain = {
    ...getMockProducerKeychain(),
    users: [userIdToRemove, userIdToNotRemove],
  };

  const serviceResponse = getMockWithMetadata(mockProducerKeychain);

  const makeRequest = async (
    token: string,
    producerKeychainId: ProducerKeychainId,
    userId: UserId
  ) =>
    request(api)
      .delete(`/producerKeychains/${producerKeychainId}/users/${userId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];

  authorizationService.removeProducerKeychainUser = vi
    .fn()
    .mockResolvedValue(serviceResponse);

  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(
        token,
        mockProducerKeychain.id,
        userIdToRemove
      );
      expect(res.status).toBe(200);
      expect(res.body).toEqual(
        testToFullProducerKeychain(mockProducerKeychain)
      );
      expect(res.headers["x-metadata-version"]).toBe(
        serviceResponse.metadata.version.toString()
      );
      expect(
        authorizationService.removeProducerKeychainUser
      ).toHaveBeenCalledWith(
        {
          producerKeychainId: mockProducerKeychain.id,
          userIdToRemove,
        },
        expect.any(Object)
      );
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

  it.each([
    {
      error: producerKeychainNotFound(mockProducerKeychain.id),
      expectedStatus: 404,
    },
    {
      error: producerKeychainUserIdNotFound(
        userIdToRemove,
        mockProducerKeychain.id
      ),
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
      authorizationService.removeProducerKeychainUser = vi
        .fn()
        .mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        mockProducerKeychain.id,
        userIdToRemove
      );
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    {},
    { producerKeychainId: "invalidId", userId: userIdToRemove },
    { producerKeychainId: mockProducerKeychain.id, userId: "invalidId" },
  ])(
    "Should return 400 if passed invalid params: %s",
    async ({ producerKeychainId, userId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        producerKeychainId as ProducerKeychainId,
        userId as UserId
      );

      expect(res.status).toBe(400);
    }
  );
});
