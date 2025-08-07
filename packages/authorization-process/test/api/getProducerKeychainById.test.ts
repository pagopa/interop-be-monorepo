/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import {
  ProducerKeychain,
  ProducerKeychainId,
  generateId,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockProducerKeychain,
  getMockWithMetadata,
  mockTokenOrganizationId,
} from "pagopa-interop-commons-test/index.js";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { api, authorizationService } from "../vitest.api.setup.js";
import { producerKeychainNotFound } from "../../src/model/domain/errors.js";
import {
  testToPartialProducerKeychain,
  testToFullProducerKeychain,
} from "../apiUtils.js";

describe("API /producerKeychains/{producerKeychainId} authorization test", () => {
  const mockProducerKeychain: ProducerKeychain = getMockProducerKeychain();
  const serviceResponse = getMockWithMetadata(mockProducerKeychain);
  authorizationService.getProducerKeychainById = vi
    .fn()
    .mockResolvedValue(serviceResponse);

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
    authRole.M2M_ADMIN_ROLE,
  ];

  it.each(authorizedRoles)(
    "Should return 200 with a partial producerKeychain for user with role %s and tenant != producerKeychain producerId",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, mockProducerKeychain.id);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(
        testToPartialProducerKeychain(mockProducerKeychain)
      );
      expect(res.headers["x-metadata-version"]).toBe(
        serviceResponse.metadata.version.toString()
      );
    }
  );

  it.each(authorizedRoles)(
    "Should return 200 with a full producerKeychain for user with role %s and tenant = producerKeychain producerId",
    async (role) => {
      const mockProducerKeychain = getMockProducerKeychain({
        producerId: mockTokenOrganizationId,
      });
      const serviceResponse = getMockWithMetadata(mockProducerKeychain);
      authorizationService.getProducerKeychainById = vi
        .fn()
        .mockResolvedValueOnce(serviceResponse);
      const token = generateToken(role);
      const res = await makeRequest(token, mockProducerKeychain.id);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(
        testToFullProducerKeychain(mockProducerKeychain)
      );
      expect(res.headers["x-metadata-version"]).toBe(
        serviceResponse.metadata.version.toString()
      );
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
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      authorizationService.getProducerKeychainById = vi
        .fn()
        .mockRejectedValue(error);

      const res = await makeRequest(
        generateToken(authRole.ADMIN_ROLE),
        mockProducerKeychain.id
      );
      expect(res.status).toBe(expectedStatus);
    }
  );
});
