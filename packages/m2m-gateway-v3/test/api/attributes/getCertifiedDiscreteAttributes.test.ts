import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiAttribute,
  getMockDPoPProof,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole, genericLogger } from "pagopa-interop-commons";
import request from "supertest";
import {
  attributeRegistryApi,
  m2mGatewayApiV3,
} from "pagopa-interop-api-clients";
import { api, mockAttributeService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { toM2MGatewayApiCertifiedDiscreteAttribute } from "../../../src/api/attributeApiConverter.js";

describe("GET /certifiedDiscreteAttributes router test", () => {
  const mockApiAttribute1 = getMockedApiAttribute({
    kind: attributeRegistryApi.AttributeKind.Values.CERTIFIED_DISCRETE,
  });

  const mockApiAttribute2 = getMockedApiAttribute({
    kind: attributeRegistryApi.AttributeKind.Values.CERTIFIED_DISCRETE,
  });

  const mockCertifiedDiscreteAttributesResponse: m2mGatewayApiV3.CertifiedDiscreteAttributes =
    {
      results: [
        toM2MGatewayApiCertifiedDiscreteAttribute({
          attribute: mockApiAttribute1,
          logger: genericLogger,
        }),
        toM2MGatewayApiCertifiedDiscreteAttribute({
          attribute: mockApiAttribute2,
          logger: genericLogger,
        }),
      ],
      pagination: {
        limit: 10,
        offset: 0,
        totalCount: 2,
      },
    };

  const mockQueryParams: m2mGatewayApiV3.GetCertifiedDiscreteAttributesQueryParams =
    {
      offset: 0,
      limit: 10,
    };

  const makeRequest = async (
    token: string,
    query: m2mGatewayApiV3.GetCertifiedDiscreteAttributesQueryParams
  ) =>
    request(api)
      .get(`${appBasePath}/certifiedDiscreteAttributes`)
      .set("Authorization", `DPoP ${token}`)
      .set("DPoP", (await getMockDPoPProof()).dpopProofJWS)
      .query(query)
      .send();

  const authorizedRoles: AuthRole[] = [
    authRole.M2M_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];

  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockAttributeService.getCertifiedDiscreteAttributes = vi
        .fn()
        .mockResolvedValue(mockCertifiedDiscreteAttributesResponse);

      const token = generateToken(role);
      const res = await makeRequest(token, mockQueryParams);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockCertifiedDiscreteAttributesResponse);
      expect(
        mockAttributeService.getCertifiedDiscreteAttributes
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
    { ...mockQueryParams, offset: -1 },
    { ...mockQueryParams, limit: 0 },
    { ...mockQueryParams, limit: 51 },
    { ...mockQueryParams, offset: "invalidOffset" },
    { ...mockQueryParams, limit: "invalidLimit" },
    { ...mockQueryParams, offset: undefined },
    { ...mockQueryParams, limit: undefined },
  ])("Should return 400 if passed invalid query params", async (query) => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      query as m2mGatewayApiV3.GetCertifiedDiscreteAttributesQueryParams
    );

    expect(res.status).toBe(400);
  });

  it.each([
    {
      ...mockCertifiedDiscreteAttributesResponse,
      results: [
        {
          ...mockCertifiedDiscreteAttributesResponse.results[0],
          code: undefined,
        },
      ],
    },
    {
      ...mockCertifiedDiscreteAttributesResponse,
      pagination: {
        offset: "invalidOffset",
        limit: "invalidLimit",
        totalCount: 0,
      },
    },
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockAttributeService.getCertifiedDiscreteAttributes = vi
        .fn()
        .mockResolvedValueOnce(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, mockQueryParams);

      expect(res.status).toBe(500);
    }
  );
});
