/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import {
  EService,
  EServiceId,
  generateId,
  ProducerKeychain,
  ProducerKeychainId,
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
  tenantNotAllowedOnEService,
  tenantNotAllowedOnProducerKeychain,
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

  const makeRequest = async (
    token: string,
    producerKeychainId: ProducerKeychainId,
    eserviceId: EServiceId = mockEService.id
  ) =>
    request(api)
      .post(`/producerKeychains/${producerKeychainId}/eservices`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send({ eserviceId });

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

  it.each([
    {
      error: producerKeychainNotFound(mockProducerKeychain.id),
      expectedStatus: 404,
    },
    {
      error: eserviceNotFound(mockEService.id),
      expectedStatus: 404,
    },
    {
      error: eserviceAlreadyLinkedToProducerKeychain(
        mockEService.id,
        mockProducerKeychain.id
      ),
      expectedStatus: 409,
    },
    {
      error: tenantNotAllowedOnProducerKeychain(
        generateId(),
        mockProducerKeychain.id
      ),
      expectedStatus: 403,
    },
    {
      error: tenantNotAllowedOnEService(generateId(), mockEService.id),
      expectedStatus: 403,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      authorizationService.addProducerKeychainEService = vi
        .fn()
        .mockRejectedValue(error);

      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, mockProducerKeychain.id);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    {},
    { producerKeychainId: "invalidId", eserviceId: mockEService.id },
    { producerKeychainId: mockProducerKeychain.id, eserviceId: "invalidId" },
  ])(
    "Should return 400 if passed invalid params: %s",
    async ({ producerKeychainId, eserviceId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        producerKeychainId as ProducerKeychainId,
        eserviceId as EServiceId
      );

      expect(res.status).toBe(400);
    }
  );
});
