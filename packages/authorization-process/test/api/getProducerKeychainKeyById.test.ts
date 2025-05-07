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
import { keyToApiKey } from "../../src/model/domain/apiConverter.js";
import { api, authorizationService } from "../vitest.api.setup.js";
import {
  organizationNotAllowedOnProducerKeychain,
  producerKeychainNotFound,
  producerKeyNotFound,
} from "../../src/model/domain/errors.js";

describe("API /producerKeychains/{producerKeychainId}/keys/{keyId} authorization test", () => {
  const mockKey1 = getMockKey();
  const mockKey2 = getMockKey();
  const mockProducerKeychain: ProducerKeychain = {
    ...getMockProducerKeychain(),
    keys: [mockKey1, mockKey2],
  };

  const apiKey = keyToApiKey(mockKey1);

  authorizationService.getProducerKeychainKeyById = vi
    .fn()
    .mockResolvedValue(mockKey1);

  const makeRequest = async (
    token: string,
    producerKeychainId: string,
    keyId: string
  ) =>
    request(api)
      .get(`/producerKeychains/${producerKeychainId}/keys/${keyId}`)
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
      const res = await makeRequest(
        token,
        mockProducerKeychain.id,
        mockKey1.kid
      );
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiKey);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockProducerKeychain.id, mockKey1.kid);

    expect(res.status).toBe(403);
  });

  it("Should return 404 for producerKeychainNotFound", async () => {
    authorizationService.getProducerKeychainKeyById = vi
      .fn()
      .mockRejectedValue(producerKeychainNotFound(mockProducerKeychain.id));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, generateId(), mockKey1.kid);
    expect(res.status).toBe(404);
  });

  it("Should return 404 for producerKeyNotFound", async () => {
    authorizationService.getProducerKeychainKeyById = vi
      .fn()
      .mockRejectedValue(
        producerKeyNotFound(mockKey1.userId, mockProducerKeychain.id)
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, generateId(), mockKey1.kid);
    expect(res.status).toBe(404);
  });

  it("Should return 403 for organizationNotAllowedOnProducerKeychain", async () => {
    authorizationService.getProducerKeychainKeyById = vi
      .fn()
      .mockRejectedValue(
        organizationNotAllowedOnProducerKeychain(
          generateId(),
          mockProducerKeychain.id
        )
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockProducerKeychain.id, mockKey1.kid);
    expect(res.status).toBe(403);
  });

  it("Should return 400 if passed an invalid field", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid", "invalid");
    expect(res.status).toBe(400);
  });
});
