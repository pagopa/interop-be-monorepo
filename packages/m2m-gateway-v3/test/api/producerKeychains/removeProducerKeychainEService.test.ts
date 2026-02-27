import { describe, it, expect, vi } from "vitest";
import { generateToken } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { generateId, pollingMaxRetriesExceeded } from "pagopa-interop-models";
import { api, mockProducerKeychainService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { missingMetadata } from "../../../src/model/errors.js";
import { config } from "../../../src/config/config.js";

describe("DELETE /producerKeychains/:keychainId/eservices/:eserviceId router test", () => {
  const makeRequest = async (
    token: string,
    producerKeychainId: string,
    eserviceId: string
  ) =>
    request(api)
      .delete(
        `${appBasePath}/producerKeychains/${producerKeychainId}/eservices/${eserviceId}`
      )
      .set("Authorization", `Bearer ${token}`)
      .send();

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 204 and perform service calls for user with role %s",
    async (role) => {
      const eserviceIdToRemove = generateId();
      const producerKeychainId = generateId();
      mockProducerKeychainService.removeProducerKeychainEService = vi.fn();

      const token = generateToken(role);
      const res = await makeRequest(
        token,
        producerKeychainId,
        eserviceIdToRemove
      );

      expect(res.status).toBe(204);
      expect(res.body).toEqual({});
      expect(
        mockProducerKeychainService.removeProducerKeychainEService
      ).toHaveBeenCalledWith(
        producerKeychainId,
        eserviceIdToRemove,
        expect.any(Object) // Context
      );
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, generateId(), generateId());
    expect(res.status).toBe(403);
  });

  it("Should return 400 if passed an invalid producerKeychain id", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      "invalid-producerKeychain-id",
      generateId()
    );

    expect(res.status).toBe(400);
  });

  it("Should return 400 if passed an invalid eservice id", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, generateId(), "invalid-eservice-id");

    expect(res.status).toBe(400);
  });

  it.each([
    missingMetadata(),
    pollingMaxRetriesExceeded(
      config.defaultPollingMaxRetries,
      config.defaultPollingRetryDelay
    ),
  ])("Should return 500 in case of $code error", async (error) => {
    mockProducerKeychainService.removeProducerKeychainEService = vi
      .fn()
      .mockRejectedValue(error);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, generateId(), generateId());

    expect(res.status).toBe(500);
  });
});
