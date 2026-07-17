import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockDPoPProof,
  getMockedApiCertifiedDiscreteTenantAttribute,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { generateId } from "pagopa-interop-models";
import { api, mockTenantService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { toM2MGatewayApiTenantCertifiedDiscreteAttribute } from "../../../src/api/tenantApiConverter.js";

describe("GET /tenants/:tenantId/certifiedDiscreteAttributes route test", () => {
  const mockQueryParams: m2mGatewayApiV3.GetTenantCertifiedDiscreteAttributesQueryParams =
    {
      offset: 0,
      limit: 10,
    };

  const mockTenantAttribute1 = getMockedApiCertifiedDiscreteTenantAttribute();

  const mockTenantAttribute2 = getMockedApiCertifiedDiscreteTenantAttribute({
    revoked: true,
  });

  const mockResponse: m2mGatewayApiV3.TenantCertifiedDiscreteAttributes = {
    results: [
      toM2MGatewayApiTenantCertifiedDiscreteAttribute(mockTenantAttribute1),
      toM2MGatewayApiTenantCertifiedDiscreteAttribute(mockTenantAttribute2),
    ],
    pagination: {
      limit: 10,
      offset: 0,
      totalCount: 2,
    },
  };

  const makeRequest = async (
    token: string,
    query: m2mGatewayApiV3.GetTenantCertifiedDiscreteAttributesQueryParams
  ) =>
    request(api)
      .get(`${appBasePath}/tenants/${generateId()}/certifiedDiscreteAttributes`)
      .query(query)
      .set("Authorization", `DPoP ${token}`)
      .set("DPoP", (await getMockDPoPProof()).dpopProofJWS);

  const authorizedRoles: AuthRole[] = [
    authRole.M2M_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];

  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockTenantService.getTenantCertifiedDiscreteAttributes = vi
        .fn()
        .mockResolvedValue(mockResponse);

      const token = generateToken(role);
      const res = await makeRequest(token, mockQueryParams);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockResponse);
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
    { ...mockQueryParams, offset: -2 },
    { ...mockQueryParams, limit: 100 },
    { ...mockQueryParams, offset: "invalidOffset" },
    { ...mockQueryParams, limit: "invalidLimit" },
  ])("Should return 400 if passed invalid query params", async (query) => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      query as m2mGatewayApiV3.GetTenantCertifiedDiscreteAttributesQueryParams
    );

    expect(res.status).toBe(400);
  });

  it.each([
    {
      ...mockResponse,
      results: [{ ...mockResponse.results[0], id: "invalidId" }],
    },
    {
      ...mockResponse,
      results: [{ ...mockResponse.results[0], assignedAt: "invalidDate" }],
    },
    {
      ...mockResponse,
      pagination: {
        offset: "invalidOffset",
        limit: "invalidLimit",
        totalCount: 0,
      },
    },
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockTenantService.getTenantCertifiedDiscreteAttributes = vi
        .fn()
        .mockResolvedValue(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, mockQueryParams);

      expect(res.status).toBe(500);
    }
  );
});
