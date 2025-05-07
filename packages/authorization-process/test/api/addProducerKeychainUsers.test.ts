/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import {
  generateId,
  ProducerKeychain,
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
  organizationNotAllowedOnProducerKeychain,
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

  const makeRequest = async (token: string, producerKeychainId: string) =>
    request(api)
      .post(`/producerKeychains/${producerKeychainId}/users`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send({ userIds: userIdsToAdd });

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

  it("Should return 404 for producerKeychainNotFound", async () => {
    authorizationService.addProducerKeychainUsers = vi
      .fn()
      .mockRejectedValue(producerKeychainNotFound(mockProducerKeychain.id));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockProducerKeychain.id);
    expect(res.status).toBe(404);
  });

  it("Should return 403 for organizationNotAllowedOnProducerKeychain", async () => {
    authorizationService.addProducerKeychainUsers = vi
      .fn()
      .mockRejectedValue(
        organizationNotAllowedOnProducerKeychain(
          generateId(),
          mockProducerKeychain.id
        )
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockProducerKeychain.id);
    expect(res.status).toBe(403);
  });

  it("Should return 403 for userWithoutSecurityPrivileges", async () => {
    authorizationService.addProducerKeychainUsers = vi
      .fn()
      .mockRejectedValue(userWithoutSecurityPrivileges(generateId(), users[0]));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockProducerKeychain.id);
    expect(res.status).toBe(403);
  });

  it("Should return 400 for producerKeychainUserAlreadyAssigned", async () => {
    authorizationService.addProducerKeychainUsers = vi
      .fn()
      .mockRejectedValue(
        producerKeychainUserAlreadyAssigned(mockProducerKeychain.id, users[0])
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockProducerKeychain.id);
    expect(res.status).toBe(400);
  });

  it("Should return 400 if passed an invalid field", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid");
    expect(res.status).toBe(400);
  });
});
