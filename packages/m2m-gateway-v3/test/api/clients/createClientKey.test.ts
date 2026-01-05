import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockClientJWKKey,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { generateId } from "pagopa-interop-models";
import { api, mockClientService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { toM2MKey } from "../../../src/api/keysApiConverter.js";

describe("POST /clients/:clientId/keys router test", () => {
  const makeRequest = async (
    token: string,
    clientId: string,
    seed: m2mGatewayApiV3.JWKSeed
  ) =>
    request(api)
      .post(`${appBasePath}/clients/${clientId}/keys`)
      .set("Authorization", `Bearer ${token}`)
      .send(seed);

  const keySeed: m2mGatewayApiV3.JWKSeed = {
    name: "key seed",
    use: "ENC",
    key: `MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAsFakePem`,
    alg: "",
  };

  const mockJwk = getMockClientJWKKey();

  const authorizedRoles: AuthRole[] = [
    authRole.M2M_ADMIN_ROLE,
    authRole.M2M_ROLE,
  ];
  it.each(authorizedRoles)(
    "Should return 201 and perform service calls for user with role %s",
    async (role) => {
      const clientId = generateId();
      mockClientService.createClientKey = vi
        .fn()
        .mockImplementation(() => toM2MKey({ clientId, jwk: mockJwk }));
      const token = generateToken(role);
      const res = await makeRequest(token, clientId, keySeed);
      const { clientId: _, ...jwkWithoutClientId } = mockJwk;
      expect(res.status).toBe(201);
      expect(res.body).toEqual({ clientId, jwk: jwkWithoutClientId });
      expect(mockClientService.createClientKey).toHaveBeenCalledWith(
        clientId,
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
      seed as m2mGatewayApiV3.JWKSeed
    );

    expect(res.status).toBe(400);
  });
});
