/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import { generateToken } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { generateId } from "pagopa-interop-models";
import { api, mockTenantService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("GET /tenants/:tenantId/certifiedAttributes route test", () => {
  const mockResponse: m2mGatewayApi.TenantCertifiedAttributes = {
    results: [
      {
        id: generateId(),
        name: "test-1",
        description: "test-1",
        assignedAt: new Date().toISOString(),
        code: "CODE",
        origin: "ORIGIN",
      },
    ],
    pagination: {
      limit: 10,
      offset: 0,
      totalCount: 1,
    },
  };

  const makeRequest = async (token: string, query: Record<string, unknown>) =>
    request(api)
      .get(`${appBasePath}/tenants/${generateId()}/certifiedAttributes`)
      .query(query)
      .set("Authorization", `Bearer ${token}`);

  const authorizedRoles: AuthRole[] = [
    authRole.M2M_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];

  it.each(authorizedRoles)(
    "Should return 200 and perform API clients calls for user with role %s",
    async (role) => {
      mockTenantService.getCertifiedAttributes = vi
        .fn()
        .mockResolvedValue(mockResponse);

      const token = generateToken(role);
      const res = await makeRequest(token, { offset: 0, limit: 10 });

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockResponse);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, { offset: 0, limit: 10 });
    expect(res.status).toBe(403);
  });

  it("Should return 400 if passed an invalid query parameter (missing offset and limit)", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, {});

    expect(res.status).toBe(400);
  });
});
