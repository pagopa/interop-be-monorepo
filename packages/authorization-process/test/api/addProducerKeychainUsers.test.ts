/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import {
  generateId,
  ProducerKeychain,
  ProducerKeychainId,
  UserId,
  WithMetadata,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockProducerKeychain,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, authorizationService } from "../vitest.api.setup.js";
import {
  tenantNotAllowedOnProducerKeychain,
  producerKeychainNotFound,
  producerKeychainUserAlreadyAssigned,
  userWithoutSecurityPrivileges,
  tenantNotFound,
  missingSelfcareId,
} from "../../src/model/domain/errors.js";
import { testToFullProducerKeychain } from "../apiUtils.js";

describe("API /producerKeychains/{producerKeychainId}/users authorization test", () => {
  const users: UserId[] = [generateId()];
  const userIdsToAdd: UserId[] = [generateId(), generateId()];

  const mockProducerKeychain: WithMetadata<ProducerKeychain> =
    getMockWithMetadata({
      ...getMockProducerKeychain(),
      users,
    });

  const serviceResponse = mockProducerKeychain;
  authorizationService.addProducerKeychainUsers = vi
    .fn()
    .mockResolvedValue(serviceResponse);

  const makeRequest = async (
    token: string,
    producerKeychainId: ProducerKeychainId,
    userIds: UserId[] = userIdsToAdd
  ) =>
    request(api)
      .post(`/producerKeychains/${producerKeychainId}/users`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send({ userIds });

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];

  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, mockProducerKeychain.data.id);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(
        testToFullProducerKeychain(mockProducerKeychain.data)
      );
    }
  );

  it.each([
    {
      error: producerKeychainNotFound(mockProducerKeychain.data.id),
      expectedStatus: 404,
    },
    {
      error: tenantNotAllowedOnProducerKeychain(
        generateId(),
        mockProducerKeychain.data.id
      ),
      expectedStatus: 403,
    },
    {
      error: userWithoutSecurityPrivileges(generateId(), users[0]),
      expectedStatus: 403,
    },
    {
      error: producerKeychainUserAlreadyAssigned(
        mockProducerKeychain.data.id,
        users[0]
      ),
      expectedStatus: 400,
    },
    {
      error: tenantNotFound(generateId()),
      expectedStatus: 404,
    },
    {
      error: missingSelfcareId(generateId()),
      expectedStatus: 500,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      authorizationService.addProducerKeychainUsers = vi
        .fn()
        .mockRejectedValue(error);

      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, mockProducerKeychain.data.id);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    {},
    { producerKeychainId: "invalidId", userIds: userIdsToAdd },
    {
      producerKeychainId: mockProducerKeychain.data.id,
      userIds: ["invalidId"],
    },
  ])(
    "Should return 400 if passed invalid params: %s",
    async ({ producerKeychainId, userIds }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        producerKeychainId as ProducerKeychainId,
        userIds as UserId[]
      );

      expect(res.status).toBe(400);
    }
  );
});
