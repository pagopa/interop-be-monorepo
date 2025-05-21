import { describe, it, expect, vi } from "vitest";
import { generateToken } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { m2mGatewayApi, tenantApi } from "pagopa-interop-api-clients";
import { generateId } from "pagopa-interop-models";
import { api, mockTenantService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockedApiAttribute } from "../../mockUtils.js";
import { toM2MGatewayApiTenantCertifiedAttribute } from "../../../src/api/tenantApiConverter.js";
import {
  unexpectedAttributeKind,
  unexpectedUndefinedAttributeOriginOrCode,
} from "../../../src/model/errors.js";

describe("GET /tenants/:tenantId/certifiedAttributes route test", () => {
  const mockQueryParams: m2mGatewayApi.GetCertifiedAttributesQueryParams = {
    offset: 0,
    limit: 10,
  };

  const mockApiAttribute1 = getMockedApiAttribute();
  const mockApiAttribute2 = getMockedApiAttribute();

  const mockTenantAttribute1: tenantApi.CertifiedTenantAttribute = {
    id: mockApiAttribute1.data.id,
    assignmentTimestamp: new Date().toISOString(),
  };

  const mockTenantAttribute2: tenantApi.CertifiedTenantAttribute = {
    id: mockApiAttribute2.data.id,
    assignmentTimestamp: new Date().toISOString(),
  };

  const mockResponse: m2mGatewayApi.TenantCertifiedAttributes = {
    results: [
      toM2MGatewayApiTenantCertifiedAttribute(
        mockTenantAttribute1,
        mockApiAttribute1.data
      ),
      toM2MGatewayApiTenantCertifiedAttribute(
        mockTenantAttribute2,
        mockApiAttribute2.data
      ),
    ],
    pagination: {
      limit: 10,
      offset: 0,
      totalCount: 2,
    },
  };

  const makeRequest = async (
    token: string,
    query: m2mGatewayApi.GetCertifiedAttributesQueryParams
  ) =>
    request(api)
      .get(`${appBasePath}/tenants/${generateId()}/certifiedAttributes`)
      .query(query)
      .set("Authorization", `Bearer ${token}`);

  const authorizedRoles: AuthRole[] = [
    authRole.M2M_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];

  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockTenantService.getCertifiedAttributes = vi
        .fn()
        .mockResolvedValue(mockResponse);

      const token = generateToken([role]);
      const res = await makeRequest(token, mockQueryParams);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockResponse);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken([role]);
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
    const token = generateToken([authRole.M2M_ADMIN_ROLE]);
    const res = await makeRequest(
      token,
      query as unknown as m2mGatewayApi.GetCertifiedAttributesQueryParams
    );

    expect(res.status).toBe(400);
  });

  it.each([
    {
      ...mockResponse,
      results: [{ ...mockResponse.results[0], name: 0 }],
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
      mockTenantService.getCertifiedAttributes = vi
        .fn()
        .mockResolvedValue(resp);
      const token = generateToken([authRole.M2M_ADMIN_ROLE]);
      const res = await makeRequest(token, mockQueryParams);

      expect(res.status).toBe(500);
    }
  );

  it.each([
    unexpectedAttributeKind(mockApiAttribute1.data),
    unexpectedUndefinedAttributeOriginOrCode(mockApiAttribute1.data),
  ])("Should return 500 in case of $code error", async (error) => {
    mockTenantService.getCertifiedAttributes = vi.fn().mockRejectedValue(error);
    const token = generateToken([authRole.M2M_ADMIN_ROLE]);
    const res = await makeRequest(token, mockQueryParams);

    expect(res.status).toBe(500);
  });
});
