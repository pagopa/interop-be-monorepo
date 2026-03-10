import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockClientJWKKey,
  getMockDPoPProof,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { generateId } from "pagopa-interop-models";
import { api, mockClientService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { toM2MJWK } from "../../../src/api/keysApiConverter.js";

describe("GET /clients/:clientId/keys router test", () => {
  const makeRequest = async (
    token: string,
    clientId: string,
    query: m2mGatewayApiV3.GetClientKeysQueryParams
  ) =>
    request(api)
      .get(`${appBasePath}/clients/${clientId}/keys`)
      .set("Authorization", `DPoP ${token}`)
      .set("DPoP", (await getMockDPoPProof()).dpopProofJWS)
      .query(query)
      .send();

  const mockApiKey1 = getMockClientJWKKey();
  const mockApiKey2 = getMockClientJWKKey();

  const mockM2MJWKsResponse: m2mGatewayApiV3.JWKs = {
    pagination: { offset: 0, limit: 10, totalCount: 2 },
    results: [toM2MJWK(mockApiKey1), toM2MJWK(mockApiKey2)],
  };

  const mockQueryParams: m2mGatewayApiV3.GetClientKeysQueryParams = {
    offset: 0,
    limit: 10,
  };

  const authorizedRoles: AuthRole[] = [
    authRole.M2M_ADMIN_ROLE,
    authRole.M2M_ROLE,
  ];
  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      const clientId = generateId();
      mockClientService.getClientKeys = vi
        .fn()
        .mockResolvedValue(mockM2MJWKsResponse);

      const token = generateToken(role);
      const res = await makeRequest(token, clientId, mockQueryParams);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MJWKsResponse);
      expect(mockClientService.getClientKeys).toHaveBeenCalledWith(
        clientId,
        mockQueryParams,
        expect.any(Object) // context
      );
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, generateId(), mockQueryParams);
    expect(res.status).toBe(403);
  });

  it.each([
    { ...mockQueryParams, offset: -2 },
    { ...mockQueryParams, limit: 100 },
    { ...mockQueryParams, offset: "invalidOffset" },
    { ...mockQueryParams, limit: "invalidLimit" },
  ])("Should return 400 if passed invalid query params", async (query) => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      generateId(),
      query as m2mGatewayApiV3.GetClientKeysQueryParams
    );

    expect(res.status).toBe(400);
  });

  it.each([
    {
      ...mockM2MJWKsResponse,
      results: [{ ...mockM2MJWKsResponse.results[0], kid: undefined }],
    },
    {
      ...mockM2MJWKsResponse,
      results: [
        { ...mockM2MJWKsResponse.results[0], invalidParam: "invalidValue" },
      ],
    },
    {
      ...mockM2MJWKsResponse,
      pagination: {
        offset: "invalidOffset",
        limit: "invalidLimit",
        totalCount: 0,
      },
    },
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockClientService.getClientKeys = vi.fn().mockResolvedValueOnce(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, generateId(), mockQueryParams);

      expect(res.status).toBe(500);
    }
  );
});
