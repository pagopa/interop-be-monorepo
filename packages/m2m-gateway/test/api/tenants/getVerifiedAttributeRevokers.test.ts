import { describe, it, expect, vi } from "vitest";
import { generateToken } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { m2mGatewayApi, tenantApi } from "pagopa-interop-api-clients";
import { generateId } from "pagopa-interop-models";
import { api, mockTenantService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { toM2MGatewayApiTenantRevoker } from "../../../src/api/tenantApiConverter.js";

describe("GET /tenants/:tenantId/verifiedAttributes/:attributeId/revokers route test", () => {
  const tenantId = generateId();
  const attributeId = generateId();
  const mockQueryParams: m2mGatewayApi.GetTenantVerifiedAttributesQueryParams =
    {
      offset: 0,
      limit: 10,
    };

  const mockRevoker1: tenantApi.TenantRevoker = {
    id: generateId(),
    verificationDate: new Date().toISOString(),
    expirationDate: new Date().toISOString(),
    extensionDate: new Date().toISOString(),
    revocationDate: new Date().toISOString(),
    delegationId: generateId(),
  };

  const mockRevoker2: tenantApi.TenantRevoker = {
    id: generateId(),
    verificationDate: new Date().toISOString(),
    expirationDate: new Date().toISOString(),
    extensionDate: new Date().toISOString(),
    revocationDate: new Date().toISOString(),
    delegationId: generateId(),
  };

  const mockResponse: m2mGatewayApi.TenantRevokers = {
    results: [
      toM2MGatewayApiTenantRevoker(mockRevoker1),
      toM2MGatewayApiTenantRevoker(mockRevoker2),
    ],
    pagination: {
      limit: 10,
      offset: 0,
      totalCount: 2,
    },
  };

  const makeRequest = async (
    token: string,
    query: m2mGatewayApi.GetTenantVerifiedAttributesQueryParams
  ) =>
    request(api)
      .get(
        `${appBasePath}/tenants/${tenantId}/verifiedAttributes/${attributeId}/revokers`
      )
      .query(query)
      .set("Authorization", `Bearer ${token}`);

  const authorizedRoles: AuthRole[] = [
    authRole.M2M_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];

  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockTenantService.getTenantVerifiedAttributeRevokers = vi
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
      query as m2mGatewayApi.GetTenantVerifiedAttributesQueryParams
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
      results: [
        { ...mockResponse.results[0], verificationDate: "invalidDate" },
      ],
    },
    {
      ...mockResponse,
      results: [{ ...mockResponse.results[0], revocationDate: "invalidDate" }],
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
      mockTenantService.getTenantVerifiedAttributeRevokers = vi
        .fn()
        .mockResolvedValue(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, mockQueryParams);

      expect(res.status).toBe(500);
    }
  );
});
