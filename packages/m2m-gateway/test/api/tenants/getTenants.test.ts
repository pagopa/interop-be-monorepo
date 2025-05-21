import { describe, it, expect, vi } from "vitest";
import { generateToken } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { generateMock } from "@anatine/zod-mock";
import { z } from "zod";
import { api, mockTenantService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { toM2MGatewayApiTenant } from "../../../src/api/tenantApiConverter.js";
import { getMockedApiTenant } from "../../mockUtils.js";

describe("GET /tenants route test", () => {
  const mockApiTenant1 = getMockedApiTenant();
  const mockApiTenant2 = getMockedApiTenant();

  const mockResponse: m2mGatewayApi.Tenants = {
    results: [
      toM2MGatewayApiTenant(mockApiTenant1.data),
      toM2MGatewayApiTenant(mockApiTenant2.data),
    ],
    pagination: {
      limit: 10,
      offset: 0,
      totalCount: 2,
    },
  };

  const mockQueryParams: m2mGatewayApi.GetTenantsQueryParams = {
    externalIdOrigin: generateMock(z.string()),
    externalIdValue: generateMock(z.string()),
    offset: 0,
    limit: 10,
  };

  const makeRequest = async (
    token: string,
    query: m2mGatewayApi.GetTenantsQueryParams
  ) =>
    request(api)
      .get(`${appBasePath}/tenants`)
      .query(query)
      .set("Authorization", `Bearer ${token}`);

  const authorizedRoles: AuthRole[] = [
    authRole.M2M_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];

  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockTenantService.getTenants = vi.fn().mockResolvedValue(mockResponse);

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
      query as m2mGatewayApi.GetTenantsQueryParams
    );

    expect(res.status).toBe(400);
  });

  it.each([
    {
      ...mockResponse,
      results: [{ ...mockResponse.results[0], kind: "INVALID_KIND" }],
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
      mockTenantService.getTenants = vi.fn().mockResolvedValue(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, mockQueryParams);

      expect(res.status).toBe(500);
    }
  );
});
