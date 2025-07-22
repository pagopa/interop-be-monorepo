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
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { producerKeychainToApiProducerKeychain } from "../../src/model/domain/apiConverter.js";
import { api, authorizationService } from "../vitest.api.setup.js";
import { producerKeychainNotFound } from "../../src/model/domain/errors.js";

describe("API /producerKeychains/{producerKeychainId} authorization test", () => {
  const userId1: UserId = generateId();
  const userId2: UserId = generateId();

  const mockProducerKeychain: ProducerKeychain = {
    ...getMockProducerKeychain(),
    users: [userId1, userId2],
  };

  const apiProducerKeychain = producerKeychainToApiProducerKeychain(
    mockProducerKeychain,
    { showUsers: false }
  );

  authorizationService.getProducerKeychainById = vi.fn().mockResolvedValue({
    producerKeychain: mockProducerKeychain,
    showUsers: false,
  });

  const makeRequest = async (
    token: string,
    producerKeychainId: ProducerKeychainId
  ) =>
    request(api)
      .get(`/producerKeychains/${producerKeychainId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

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
      expect(res.body).toEqual(apiProducerKeychain);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockProducerKeychain.id);

    expect(res.status).toBe(403);
  });

  it("Should return 404 for producerKeychainNotFound", async () => {
    authorizationService.getProducerKeychainById = vi
      .fn()
      .mockRejectedValue(producerKeychainNotFound(mockProducerKeychain.id));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockProducerKeychain.id);
    expect(res.status).toBe(404);
  });
});
