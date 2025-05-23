/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import {
  generateId,
  ProducerKeychain,
  ProducerKeychainId,
  TenantId,
  UserId,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockProducerKeychain,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, authorizationService } from "../vitest.api.setup.js";
import { producerKeychainToApiProducerKeychain } from "../../src/model/domain/apiConverter.js";
import {
  tenantNotAllowedOnProducerKeychain,
  producerKeychainNotFound,
  producerKeychainUserAlreadyAssigned,
  userWithoutSecurityPrivileges,
} from "../../src/model/domain/errors.js";

describe("API /producerKeychains/{producerKeychainId}/users authorization test", () => {
  const producerId: TenantId = generateId();
  const users: UserId[] = [generateId()];
  const userIdsToAdd: UserId[] = [generateId(), generateId()];

  const mockProducerKeychain: ProducerKeychain = {
    ...getMockProducerKeychain(),
    producerId,
    users,
  };

  const apiProducerKeyChain = producerKeychainToApiProducerKeychain(
    mockProducerKeychain,
    {
      showUsers: true,
    }
  );

  authorizationService.addProducerKeychainUsers = vi.fn().mockResolvedValue({
    producerKeychain: mockProducerKeychain,
    showUsers: true,
  });

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

  const authorizedRoles: AuthRole[] = [authRole.ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, mockProducerKeychain.id);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiProducerKeyChain);
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
    {
      error: userWithoutSecurityPrivileges(generateId(), users[0]),
      expectedStatus: 403,
    },
    {
      error: producerKeychainUserAlreadyAssigned(
        mockProducerKeychain.id,
        users[0]
      ),
      expectedStatus: 400,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      authorizationService.addProducerKeychainUsers = vi
        .fn()
        .mockRejectedValue(error);

      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, mockProducerKeychain.id);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    {},
    { producerKeychainId: "invalidId", userIds: userIdsToAdd },
    { producerKeychainId: mockProducerKeychain.id, userIds: ["invalidId"] },
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
