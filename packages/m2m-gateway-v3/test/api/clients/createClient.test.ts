import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockDPoPProof,
  getMockedApiConsumerFullClient,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { authorizationApi, m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { generateId, UserId } from "pagopa-interop-models";
import { api, mockClientService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { toM2MGatewayApiConsumerClient } from "../../../src/api/clientApiConverter.js";

describe("POST /clients router test", () => {
  const makeRequest = async (token: string, seed: m2mGatewayApiV3.ClientSeed) =>
    request(api)
      .post(`${appBasePath}/clients`)
      .set("Authorization", `DPoP ${token}`)
      .set("DPoP", (await getMockDPoPProof()).dpopProofJWS)
      .send(seed);

  const clientSeed: m2mGatewayApiV3.ClientSeed = {
    name: "client seed",
    description: "client description",
    members: [generateId<UserId>()],
  };

  const mockM2MFullClientResponse = toM2MGatewayApiConsumerClient(
    getMockedApiConsumerFullClient({
      kind: authorizationApi.ClientKind.Values.CONSUMER,
    })
  );

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];

  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockClientService.createClient = vi
        .fn()
        .mockImplementation(() => Promise.resolve(mockM2MFullClientResponse));
      const token = generateToken(role);
      const res = await makeRequest(token, clientSeed);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MFullClientResponse);
      expect(mockClientService.createClient).toHaveBeenCalledWith(
        clientSeed,
        expect.any(Object) // context
      );
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, clientSeed);
    expect(res.status).toBe(403);
  });

  it.each([
    { ...clientSeed, name: 1 },
    { ...clientSeed, members: 7 },
    { ...clientSeed, description: 9 },
    {},
  ])("Should return 400 if passed invalid body", async (seed) => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, seed as m2mGatewayApiV3.ClientSeed);

    expect(res.status).toBe(400);
  });
});
