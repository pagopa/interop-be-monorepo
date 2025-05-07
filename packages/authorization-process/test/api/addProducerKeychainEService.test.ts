/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import {
  EService,
  EServiceId,
  generateId,
  ProducerKeychain,
  TenantId,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockEService,
  getMockProducerKeychain,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, authorizationService } from "../vitest.api.setup.js";
import {
  eserviceAlreadyLinkedToProducerKeychain,
  eserviceNotFound,
  organizationNotAllowedOnEService,
  organizationNotAllowedOnProducerKeychain,
  producerKeychainNotFound,
} from "../../src/model/domain/errors.js";

describe("API /producerKeychains/{producerKeychainId}/eservices authorization test", () => {
  const mockProducerId: TenantId = generateId();
  const mockEServiceId: EServiceId = generateId();

  const mockEService: EService = {
    ...getMockEService(),
    id: mockEServiceId,
    producerId: mockProducerId,
  };

  const mockProducerKeychain: ProducerKeychain = {
    ...getMockProducerKeychain(),
    producerId: mockProducerId,
  };

  authorizationService.addProducerKeychainEService = vi
    .fn()
    .mockResolvedValue({});

  const makeRequest = async (token: string, producerKeychainId: string) =>
    request(api)
      .post(`/producerKeychains/${producerKeychainId}/eservices`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send({ eserviceId: mockEService.id });

  const authorizedRoles: AuthRole[] = [authRole.ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 204 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, mockProducerKeychain.id);
      expect(res.status).toBe(204);
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
    authorizationService.addProducerKeychainEService = vi
      .fn()
      .mockRejectedValue(producerKeychainNotFound(mockProducerKeychain.id));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockProducerKeychain.id);
    expect(res.status).toBe(404);
  });

  it("Should return 404 for eserviceNotFound", async () => {
    authorizationService.addProducerKeychainEService = vi
      .fn()
      .mockRejectedValue(eserviceNotFound(mockEService.id));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockProducerKeychain.id);
    expect(res.status).toBe(404);
  });

  it("Should return 409 for eserviceAlreadyLinkedToProducerKeychain", async () => {
    authorizationService.addProducerKeychainEService = vi
      .fn()
      .mockRejectedValue(
        eserviceAlreadyLinkedToProducerKeychain(
          mockEService.id,
          mockProducerKeychain.id
        )
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockProducerKeychain.id);
    expect(res.status).toBe(409);
  });

  it("Should return 403 for organizationNotAllowedOnProducerKeychain", async () => {
    authorizationService.addProducerKeychainEService = vi
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

  it("Should return 403 for organizationNotAllowedOnEService", async () => {
    authorizationService.addProducerKeychainEService = vi
      .fn()
      .mockRejectedValue(
        organizationNotAllowedOnEService(generateId(), mockEService.id)
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockProducerKeychain.id);
    expect(res.status).toBe(403);
  });

  it("Should return 400 if passed an invalid field", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid");
    expect(res.status).toBe(400);
  });
});
