import { describe, it, expect, vi } from "vitest";
import { generateToken, getMockDPoPProof } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { generateId, pollingMaxRetriesExceeded } from "pagopa-interop-models";
import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { api, mockProducerKeychainService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { missingMetadata } from "../../../src/model/errors.js";
import { config } from "../../../src/config/config.js";

describe("POST /producerKeychains/:producerKeychainId/users router test", () => {
  const linkUser: m2mGatewayApiV3.LinkUser = {
    userId: generateId(),
  };

  const makeRequest = async (
    token: string,
    producerKeychainId: string,
    body: m2mGatewayApiV3.LinkUser
  ) =>
    request(api)
      .post(`${appBasePath}/producerKeychains/${producerKeychainId}/users`)
      .set("Authorization", `DPoP ${token}`)
      .set("DPoP", (await getMockDPoPProof()).dpopProofJWS)
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 204 and perform service calls for user with role %s",
    async (role) => {
      const producerKeychainId = generateId();
      mockProducerKeychainService.addProducerKeychainUsers = vi.fn();

      const token = generateToken(role);
      const res = await makeRequest(token, producerKeychainId, linkUser);

      expect(res.status).toBe(204);
      expect(res.body).toEqual({});
      expect(
        mockProducerKeychainService.addProducerKeychainUsers
      ).toHaveBeenCalledWith(
        producerKeychainId,
        linkUser.userId,
        expect.any(Object) // Context
      );
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, generateId(), linkUser);
    expect(res.status).toBe(403);
  });

  it("Should return 400 if passed an invalid producerKeychain id", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      "invalid-producerKeychain-id",
      linkUser
    );

    expect(res.status).toBe(400);
  });

  it.each([{}, { user: undefined }, { user: "invalid-user-id" }])(
    "Should return 400 if passed an invalid seed",
    async (body) => {
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(
        token,
        generateId(),
        body as m2mGatewayApiV3.LinkUser
      );

      expect(res.status).toBe(400);
    }
  );

  it.each([
    missingMetadata(),
    pollingMaxRetriesExceeded(
      config.defaultPollingMaxRetries,
      config.defaultPollingRetryDelay
    ),
  ])("Should return 500 in case of $code error", async (error) => {
    mockProducerKeychainService.addProducerKeychainUsers = vi
      .fn()
      .mockRejectedValue(error);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, generateId(), linkUser);

    expect(res.status).toBe(500);
  });
});
