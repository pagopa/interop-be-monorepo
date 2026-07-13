/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiPartialProducerKeychain,
  getMockedApiFullProducerKeychain,
  getMockDPoPProof,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { generateId } from "pagopa-interop-models";
import { api, mockProducerKeychainService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { toM2MGatewayApiProducerKeychain } from "../../../src/api/producerKeychainApiConverter.js";

describe("GET /producerKeychains/:keychainId route test", () => {
  const mockM2MFullProducerKeychainResponse = toM2MGatewayApiProducerKeychain(
    getMockedApiFullProducerKeychain()
  );

  const mockM2MPartialProducerKeychainResponse =
    toM2MGatewayApiProducerKeychain(getMockedApiPartialProducerKeychain());

  const makeRequest = async (
    token: string,
    keychainId: string = generateId()
  ) =>
    request(api)
      .get(`${appBasePath}/producerKeychains/${keychainId}`)
      .set("Authorization", `DPoP ${token}`)
      .set("DPoP", (await getMockDPoPProof()).dpopProofJWS);

  const authorizedRoles: AuthRole[] = [
    authRole.M2M_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];

  it.each(authorizedRoles)(
    "Should return 200 with partial producer keychain and perform service calls for user with role %s",
    async (role) => {
      mockProducerKeychainService.getProducerKeychain = vi
        .fn()
        .mockResolvedValue(mockM2MPartialProducerKeychainResponse);

      const token = generateToken(role);
      const res = await makeRequest(
        token,
        mockM2MPartialProducerKeychainResponse.id
      );

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MPartialProducerKeychainResponse);
    }
  );

  it.each(authorizedRoles)(
    "Should return 200 with full producer keychain and perform service calls for user with role %s",
    async (role) => {
      mockProducerKeychainService.getProducerKeychain = vi
        .fn()
        .mockResolvedValue(mockM2MFullProducerKeychainResponse);

      const token = generateToken(role);
      const res = await makeRequest(
        token,
        mockM2MFullProducerKeychainResponse.id
      );

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MFullProducerKeychainResponse);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 400 for incorrect value for keychain id", async () => {
    mockProducerKeychainService.getProducerKeychain = vi
      .fn()
      .mockResolvedValue(mockM2MPartialProducerKeychainResponse);

    const token = generateToken(authRole.M2M_ROLE);
    const res = await makeRequest(token, "INVALID ID");
    expect(res.status).toBe(400);
  });

  it.each([
    { ...mockM2MPartialProducerKeychainResponse, invalidParam: "invalidValue" },
    { ...mockM2MPartialProducerKeychainResponse, id: undefined },
    { ...mockM2MPartialProducerKeychainResponse, producerId: undefined },
    { ...mockM2MFullProducerKeychainResponse, invalidParam: "invalidValue" },
    { ...mockM2MFullProducerKeychainResponse, id: undefined },
    { ...mockM2MFullProducerKeychainResponse, createdAt: undefined },
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockProducerKeychainService.getProducerKeychain = vi
        .fn()
        .mockResolvedValue(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token);

      expect(res.status).toBe(500);
    }
  );
});
