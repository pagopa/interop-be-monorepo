import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockProducerJWKKey,
  getMockDPoPProof,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { generateId } from "pagopa-interop-models";
import { api, mockProducerKeychainService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { toM2MProducerKey } from "../../../src/api/keysApiConverter.js";

describe("POST /producerKeychains/:keychainId/keys router test", () => {
  const makeRequest = async (
    token: string,
    producerKeychainId: string,
    seed: m2mGatewayApiV3.KeySeed
  ) =>
    request(api)
      .post(`${appBasePath}/producerKeychains/${producerKeychainId}/keys`)
      .set("Authorization", `DPoP ${token}`)
      .set("DPoP", (await getMockDPoPProof()).dpopProofJWS)
      .send(seed);

  const keySeed: m2mGatewayApiV3.KeySeed = {
    name: "key seed",
    use: "ENC",
    key: `MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAsFakePem`,
    alg: "",
  };

  const mockJwk = getMockProducerJWKKey();

  const getMockedProducerKey = (producerKeychainId: string) =>
    toM2MProducerKey({ jwk: mockJwk, producerKeychainId });

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];

  it.each(authorizedRoles)(
    "Should return 201 and perform service calls for user with role %s",
    async (role) => {
      const producerKeychainId = generateId();
      const mockedResponse = getMockedProducerKey(producerKeychainId);
      mockProducerKeychainService.createProducerKeychainKey = vi
        .fn()
        .mockImplementation(() => Promise.resolve(mockedResponse));
      const token = generateToken(role);
      const res = await makeRequest(token, producerKeychainId, keySeed);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockedResponse);
      expect(
        mockProducerKeychainService.createProducerKeychainKey
      ).toHaveBeenCalledWith(
        producerKeychainId,
        keySeed,
        expect.any(Object) // context
      );
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, generateId(), keySeed);
    expect(res.status).toBe(403);
  });

  it.each([
    { ...keySeed, use: "invalidUse" },
    { ...keySeed, name: 1 },
    { ...keySeed, key: 7 },
    { ...keySeed, alg: 9 },
    {},
  ])("Should return 400 if passed invalid body", async (seed) => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      generateId(),
      seed as m2mGatewayApiV3.KeySeed
    );

    expect(res.status).toBe(400);
  });
});
