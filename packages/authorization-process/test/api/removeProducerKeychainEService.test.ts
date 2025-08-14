/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import {
  generateId,
  EServiceId,
  ProducerKeychain,
  ProducerKeychainId,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockProducerKeychain,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { api, authorizationService } from "../vitest.api.setup.js";
import {
  eserviceNotFound,
  tenantNotAllowedOnProducerKeychain,
  producerKeychainNotFound,
} from "../../src/model/domain/errors.js";
import { testToFullProducerKeychain } from "../apiUtils.js";

describe("API /producerKeychains/{producerKeychainId}/eservices/{eserviceId} authorization test", () => {
  const eserviceIdToRemove: EServiceId = generateId();
  const eserviceIdToNotRemove: EServiceId = generateId();

  const mockProducerKeychain: ProducerKeychain = {
    ...getMockProducerKeychain(),
    eservices: [eserviceIdToRemove, eserviceIdToNotRemove],
  };

  const serviceResponse = getMockWithMetadata(mockProducerKeychain);

  const makeRequest = async (
    token: string,
    producerKeychainId: ProducerKeychainId,
    eserviceId: EServiceId
  ) =>
    request(api)
      .delete(
        `/producerKeychains/${producerKeychainId}/eservices/${eserviceId}`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];

  authorizationService.removeProducerKeychainEService = vi
    .fn()
    .mockResolvedValue(serviceResponse);

  it.each(authorizedRoles)(
    "Should return 200 with a full producer keychain for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(
        token,
        mockProducerKeychain.id,
        eserviceIdToRemove
      );
      expect(res.status).toBe(200);
      expect(res.body).toEqual(
        testToFullProducerKeychain(mockProducerKeychain)
      );
      expect(res.headers["x-metadata-version"]).toBe(
        serviceResponse.metadata.version.toString()
      );
      expect(
        authorizationService.removeProducerKeychainEService
      ).toHaveBeenCalledWith(
        {
          producerKeychainId: mockProducerKeychain.id,
          eserviceIdToRemove,
        },
        expect.any(Object)
      );
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(
      token,
      mockProducerKeychain.id,
      eserviceIdToRemove
    );
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
      error: eserviceNotFound(eserviceIdToRemove),
      expectedStatus: 400,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      authorizationService.removeProducerKeychainEService = vi
        .fn()
        .mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        mockProducerKeychain.id,
        eserviceIdToRemove
      );
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    {},
    { producerKeychainId: "invalidId", eserviceId: eserviceIdToRemove },
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
