/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import {
  generateId,
  ProducerKeychain,
  ProducerKeychainId,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockKey,
  getMockProducerKeychain,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { api, authorizationService } from "../vitest.api.setup.js";
import {
  tenantNotAllowedOnProducerKeychain,
  producerKeychainNotFound,
  producerKeyNotFound,
  userNotFound,
  userWithoutSecurityPrivileges,
} from "../../src/model/domain/errors.js";

describe("API /producerKeychains/{producerKeychainId}/keys/{keyId} authorization test", () => {
  const keyToRemove = getMockKey();
  const keyToNotRemove = getMockKey();

  const mockProducerKeychain: ProducerKeychain = {
    ...getMockProducerKeychain(),
    keys: [keyToRemove, keyToNotRemove],
  };
  const makeRequest = async (
    token: string,
    producerKeychainId: ProducerKeychainId,
    keyId: string
  ) =>
    request(api)
      .delete(`/producerKeychains/${producerKeychainId}/keys/${keyId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];

  authorizationService.removeProducerKeychainKeyById = vi
    .fn()
    .mockResolvedValue({});

  it.each(authorizedRoles)(
    "Should return 204 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(
        token,
        mockProducerKeychain.id,
        keyToRemove.kid
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
      keyToRemove.kid
    );
    expect(res.status).toBe(403);
  });

  it.each([
    {
      error: producerKeychainNotFound(mockProducerKeychain.id),
      expectedStatus: 404,
    },
    {
      error: producerKeyNotFound(keyToNotRemove.kid, mockProducerKeychain.id),
      expectedStatus: 404,
    },
    {
      error: userNotFound(generateId(), mockProducerKeychain.id),
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
      error: userWithoutSecurityPrivileges(
        generateId(),
        mockProducerKeychain.users[0]
      ),
      expectedStatus: 403,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      authorizationService.removeProducerKeychainKeyById = vi
        .fn()
        .mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        mockProducerKeychain.id,
        keyToRemove.kid
      );
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([{}, { producerKeychainId: "invalidId", keyId: keyToNotRemove.kid }])(
    "Should return 400 if passed invalid params: %s",
    async ({ producerKeychainId, keyId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        producerKeychainId as ProducerKeychainId,
        keyId as string
      );

      expect(res.status).toBe(400);
    }
  );
});
