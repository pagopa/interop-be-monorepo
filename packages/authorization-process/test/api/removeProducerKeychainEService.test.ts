/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import {
  generateId,
  EServiceId,
  ProducerKeychain,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockProducerKeychain,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { api, authorizationService } from "../vitest.api.setup.js";
import {
  eserviceNotFound,
  organizationNotAllowedOnProducerKeychain,
  producerKeychainNotFound,
} from "../../src/model/domain/errors.js";

describe("API /producerKeychains/{producerKeychainId}/eservices/{eserviceId} authorization test", () => {
  const eserviceIdToRemove: EServiceId = generateId();
  const eserviceIdToNotRemove: EServiceId = generateId();

  const mockProducerKeychain: ProducerKeychain = {
    ...getMockProducerKeychain(),
    eservices: [eserviceIdToRemove, eserviceIdToNotRemove],
  };

  const makeRequest = async (
    token: string,
    producerKeychainId: string,
    eserviceId: string
  ) =>
    request(api)
      .delete(
        `/producerKeychains/${producerKeychainId}/eservices/${eserviceId}`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  const authorizedRoles: AuthRole[] = [authRole.ADMIN_ROLE];

  authorizationService.removeProducerKeychainEService = vi
    .fn()
    .mockResolvedValue({});

  it.each(authorizedRoles)(
    "Should return 204 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(
        token,
        mockProducerKeychain.id,
        eserviceIdToRemove
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
      eserviceIdToRemove
    );
    expect(res.status).toBe(403);
  });

  it("Should return 404 for producerKeychainNotFound", async () => {
    authorizationService.removeProducerKeychainEService = vi
      .fn()
      .mockRejectedValue(producerKeychainNotFound(mockProducerKeychain.id));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(
      token,
      mockProducerKeychain.id,
      eserviceIdToRemove
    );
    expect(res.status).toBe(404);
  });

  it("Should return 403 for organizationNotAllowedOnProducerKeychain", async () => {
    authorizationService.removeProducerKeychainEService = vi
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
      eserviceIdToRemove
    );
    expect(res.status).toBe(403);
  });

  it("Should return 400 for eserviceNotFound", async () => {
    authorizationService.removeProducerKeychainEService = vi
      .fn()
      .mockRejectedValue(eserviceNotFound(eserviceIdToRemove));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(
      token,
      mockProducerKeychain.id,
      eserviceIdToRemove
    );
    expect(res.status).toBe(400);
  });

  it("Should return 400 if passed an invalid field", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid", "invalid");
    expect(res.status).toBe(400);
  });
});
