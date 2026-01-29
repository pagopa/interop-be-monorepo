/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import { generateToken, getMockedApiTenant } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { m2mGatewayApiV3, tenantApi } from "pagopa-interop-api-clients";
import { api, mockTenantService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { toM2MGatewayApiTenant } from "../../../src/api/tenantApiConverter.js";

describe("GET /tenants/:tenantId route test", () => {
  const mockApiResponse = getMockedApiTenant();
  const mockResponse: m2mGatewayApiV3.Tenant =
    toM2MGatewayApiTenant(mockApiResponse);

  const makeRequest = async (token: string) =>
    request(api)
      .get(`${appBasePath}/tenants/${mockResponse.id}`)
      .set("Authorization", `Bearer ${token}`);

  const authorizedRoles: AuthRole[] = [
    authRole.M2M_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];

  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockTenantService.getTenant = vi.fn().mockResolvedValue(mockResponse);

      const token = generateToken(role);
      const res = await makeRequest(token);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockResponse);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it.each([
    { ...mockResponse, createdAt: undefined },
    { ...mockResponse, kind: "INVALID_KIND" },
    { ...mockResponse, extraParam: "extraValue" },
    {},
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockTenantService.getTenant = vi
        .fn()
        .mockResolvedValue(resp as tenantApi.Tenant);

      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token);

      expect(res.status).toBe(500);
    }
  );
});
