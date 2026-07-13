import { describe, it, expect, vi } from "vitest";
import { generateToken, getMockDPoPProof } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { generateId, pollingMaxRetriesExceeded } from "pagopa-interop-models";
import { api, mockProducerKeychainService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { missingMetadata } from "../../../src/model/errors.js";
import { config } from "../../../src/config/config.js";

describe("DELETE /producerKeychains/:keychainId/keys/:keyId router test", () => {
  const makeRequest = async (
    token: string,
    keychainId: string,
    keyId: string
  ) =>
    request(api)
      .delete(`${appBasePath}/producerKeychains/${keychainId}/keys/${keyId}`)
      .set("Authorization", `DPoP ${token}`)
      .set("DPoP", (await getMockDPoPProof()).dpopProofJWS)
      .send();

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      const keyIdToDelete = generateId();
      const keychainId = generateId();
      mockProducerKeychainService.deleteProducerKeychainKey = vi.fn();

      const token = generateToken(role);
      const res = await makeRequest(token, keychainId, keyIdToDelete);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({});
      expect(res.body).toEqual({});
      expect(
        mockProducerKeychainService.deleteProducerKeychainKey
      ).toHaveBeenCalledWith(
        keychainId,
        keyIdToDelete,
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

  it.each([
    missingMetadata(),
    pollingMaxRetriesExceeded(
      config.defaultPollingMaxRetries,
      config.defaultPollingRetryDelay
    ),
  ])("Should return 500 in case of $code error", async (error) => {
    mockProducerKeychainService.deleteProducerKeychainKey = vi
      .fn()
      .mockRejectedValue(error);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, generateId(), generateId());

    expect(res.status).toBe(500);
  });
});
