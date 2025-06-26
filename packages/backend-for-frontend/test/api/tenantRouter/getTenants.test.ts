/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import request from "supertest";
import { api, services } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockBffApiCompactTenant } from "../../mockUtils.js";

describe("API GET /tenants test", () => {
  const mockTenants: bffApi.Tenants = {
    results: [getMockBffApiCompactTenant(), getMockBffApiCompactTenant()],
    pagination: { offset: 0, limit: 10, totalCount: 20 },
  };
  const defaultQuery = {
    name: "Tenant",
    features: "PERSISTENT_CERTIFIER,DELEGATED_PRODUCER",
    limit: 10,
  };

  beforeEach(() => {
    services.tenantService.getTenants = vi.fn().mockResolvedValue(mockTenants);
  });

  const makeRequest = async (
    token: string,
    query: typeof defaultQuery = defaultQuery
  ) =>
    request(api)
      .get(`${appBasePath}/tenants`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query(query);

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockTenants);
  });

  it.each([
    { query: {} },
    { query: { ...defaultQuery, limit: -2 } },
    { query: { ...defaultQuery, limit: 55 } },
    { query: { ...defaultQuery, features: "invalid,DELEGATED_PRODUCER" } },
  ])("Should return 400 if passed invalid data: %s", async ({ query }) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, query as typeof defaultQuery);
    expect(res.status).toBe(400);
  });
});
