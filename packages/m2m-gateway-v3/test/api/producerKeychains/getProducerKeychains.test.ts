import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiPartialProducerKeychain,
  getMockedApiFullProducerKeychain,
  getMockDPoPProof,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { generateId } from "pagopa-interop-models";
import { generateMock } from "@anatine/zod-mock";
import { z } from "zod";
import { api, mockProducerKeychainService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { toM2MGatewayApiProducerKeychain } from "../../../src/api/producerKeychainApiConverter.js";

describe("GET /producerKeychains router test", () => {
  const m2mPartialProducerKeychainsResponse: m2mGatewayApiV3.ProducerKeychains =
    {
      pagination: { offset: 0, limit: 10, totalCount: 2 },
      results: [
        toM2MGatewayApiProducerKeychain(getMockedApiPartialProducerKeychain()),
        toM2MGatewayApiProducerKeychain(getMockedApiPartialProducerKeychain()),
      ],
    };

  const m2mFullProducerKeychainsResponse: m2mGatewayApiV3.ProducerKeychains = {
    pagination: { offset: 0, limit: 10, totalCount: 2 },
    results: [
      toM2MGatewayApiProducerKeychain(getMockedApiFullProducerKeychain()),
      toM2MGatewayApiProducerKeychain(getMockedApiFullProducerKeychain()),
    ],
  };

  const mockQueryParams: m2mGatewayApiV3.GetProducerKeychainsQueryParams = {
    producerId: generateId(),
    name: generateMock(z.string()),
    offset: 0,
    limit: 10,
  };

  const makeRequest = async (
    token: string,
    query: m2mGatewayApiV3.GetProducerKeychainsQueryParams
  ) =>
    request(api)
      .get(`${appBasePath}/producerKeychains`)
      .set("Authorization", `DPoP ${token}`)
      .set("DPoP", (await getMockDPoPProof()).dpopProofJWS)
      .query(query)
      .send();

  const authorizedRoles: AuthRole[] = [
    authRole.M2M_ADMIN_ROLE,
    authRole.M2M_ROLE,
  ];
  it.each(authorizedRoles)(
    "Should return 200 with full producer keychains and perform service calls for user with role %s",
    async (role) => {
      mockProducerKeychainService.getProducerKeychains = vi
        .fn()
        .mockResolvedValue(m2mFullProducerKeychainsResponse);

      const token = generateToken(role);
      const res = await makeRequest(token, mockQueryParams);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(m2mFullProducerKeychainsResponse);
      expect(
        mockProducerKeychainService.getProducerKeychains
      ).toHaveBeenCalledWith(mockQueryParams, expect.any(Object));
    }
  );

  it.each(authorizedRoles)(
    "Should return 200 with partial producer keychains and perform service calls for user with role %s",
    async (role) => {
      mockProducerKeychainService.getProducerKeychains = vi
        .fn()
        .mockResolvedValue(m2mPartialProducerKeychainsResponse);

      const token = generateToken(role);
      const res = await makeRequest(token, mockQueryParams);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(m2mPartialProducerKeychainsResponse);
      expect(
        mockProducerKeychainService.getProducerKeychains
      ).toHaveBeenCalledWith(mockQueryParams, expect.any(Object));
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockQueryParams);
    expect(res.status).toBe(403);
  });
  it.each([
    {},
    { ...mockQueryParams, producerId: "invalidProducerId" },
    { ...mockQueryParams, offset: -2 },
    { ...mockQueryParams, limit: 100 },
    { ...mockQueryParams, offset: "invalidOffset" },
    { ...mockQueryParams, limit: "invalidLimit" },
  ])("Should return 400 if passed invalid query params", async (query) => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      query as m2mGatewayApiV3.GetProducerKeychainsQueryParams
    );

    expect(res.status).toBe(400);
  });

  it.each([
    {
      ...m2mPartialProducerKeychainsResponse,
      pagination: {
        offset: "invalidOffset",
        limit: "invalidLimit",
        totalCount: 0,
      },
    },
    {
      ...m2mFullProducerKeychainsResponse,
      pagination: {
        offset: "invalidOffset",
        limit: "invalidLimit",
        totalCount: 0,
      },
    },
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockProducerKeychainService.getProducerKeychains = vi
        .fn()
        .mockResolvedValueOnce(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, mockQueryParams);

      expect(res.status).toBe(500);
    }
  );
});
