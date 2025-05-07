/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { generateId, ProducerKeychain } from "pagopa-interop-models";
import {
  generateToken,
  getMockKey,
  getMockProducerKeychain,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { api, authorizationService } from "../vitest.api.setup.js";
import {
  organizationNotAllowedOnProducerKeychain,
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
    producerKeychainId: string,
    keyId: string
  ) =>
    request(api)
      .delete(`/producerKeychains/${producerKeychainId}/keys/${keyId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  const authorizedRoles: AuthRole[] = [authRole.ADMIN_ROLE];

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

  it("Should return 404 for producerKeychainNotFound", async () => {
    authorizationService.removeProducerKeychainKeyById = vi
      .fn()
      .mockRejectedValue(producerKeychainNotFound(mockProducerKeychain.id));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(
      token,
      mockProducerKeychain.id,
      keyToRemove.kid
    );
    expect(res.status).toBe(404);
  });

  it("Should return 404 for producerKeyNotFound", async () => {
    authorizationService.removeProducerKeychainKeyById = vi
      .fn()
      .mockRejectedValue(
        producerKeyNotFound(keyToNotRemove.kid, mockProducerKeychain.id)
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(
      token,
      mockProducerKeychain.id,
      keyToRemove.kid
    );
    expect(res.status).toBe(404);
  });

  it("Should return 404 for userNotFound", async () => {
    authorizationService.removeProducerKeychainKeyById = vi
      .fn()
      .mockRejectedValue(userNotFound(generateId(), mockProducerKeychain.id));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(
      token,
      mockProducerKeychain.id,
      keyToRemove.kid
    );
    expect(res.status).toBe(404);
  });

  it("Should return 403 for organizationNotAllowedOnProducerKeychain", async () => {
    authorizationService.removeProducerKeychainKeyById = vi
      .fn()
      .mockRejectedValue(
        organizationNotAllowedOnProducerKeychain(
          generateId(),
          mockProducerKeychain.id
        )
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(
      token,
      mockProducerKeychain.id,
      keyToRemove.kid
    );
    expect(res.status).toBe(403);
  });

  it("Should return 403 for userWithoutSecurityPrivileges", async () => {
    authorizationService.removeProducerKeychainKeyById = vi
      .fn()
      .mockRejectedValue(
        userWithoutSecurityPrivileges(
          generateId(),
          mockProducerKeychain.users[0]
        )
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(
      token,
      mockProducerKeychain.id,
      keyToRemove.kid
    );
    expect(res.status).toBe(403);
  });

  it("Should return 400 if passed an invalid field", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid", "invalid");
    expect(res.status).toBe(400);
  });
});
