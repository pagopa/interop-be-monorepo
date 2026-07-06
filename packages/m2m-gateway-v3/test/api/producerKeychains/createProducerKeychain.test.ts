import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockDPoPProof,
  getMockedApiFullProducerKeychain,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { generateId, UserId } from "pagopa-interop-models";
import { api, mockProducerKeychainService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { toM2MGatewayApiProducerKeychain } from "../../../src/api/producerKeychainApiConverter.js";

describe("POST /producerKeychains router test", () => {
  const makeRequest = async (
    token: string,
    seed: m2mGatewayApiV3.ProducerKeychainSeed
  ) =>
    request(api)
      .post(`${appBasePath}/producerKeychains`)
      .set("Authorization", `DPoP ${token}`)
      .set("DPoP", (await getMockDPoPProof()).dpopProofJWS)
      .send(seed);

  const producerKeychainSeed: m2mGatewayApiV3.ProducerKeychainSeed = {
    name: "producer keychain seed",
    description: "producer keychain description",
    members: [generateId<UserId>()],
  };

  const mockM2MFullProducerKeychainResponse = toM2MGatewayApiProducerKeychain(
    getMockedApiFullProducerKeychain()
  );

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];

  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockProducerKeychainService.createProducerKeychain = vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve(mockM2MFullProducerKeychainResponse)
        );
      const token = generateToken(role);
      const res = await makeRequest(token, producerKeychainSeed);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MFullProducerKeychainResponse);
      expect(
        mockProducerKeychainService.createProducerKeychain
      ).toHaveBeenCalledWith(
        producerKeychainSeed,
        expect.any(Object) // context
      );
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, producerKeychainSeed);
    expect(res.status).toBe(403);
  });

  it.each([
    { ...producerKeychainSeed, name: 1 },
    { ...producerKeychainSeed, members: 7 },
    { ...producerKeychainSeed, description: 9 },
    {},
  ])("Should return 400 if passed invalid body", async (seed) => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      seed as m2mGatewayApiV3.ProducerKeychainSeed
    );

    expect(res.status).toBe(400);
  });
});
