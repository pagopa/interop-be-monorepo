/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { delegationApi } from "pagopa-interop-api-clients";
import { generateToken, getMockTenant } from "pagopa-interop-commons-test";
import { generateId } from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";

import { api, delegationService } from "../vitest.api.setup.js";
import { tenantToApiCompactTenant } from "../mockUtils.js";

describe("API GET /consumer/delegatorsWithAgreements test", () => {
  const mockDelegator1 = { ...getMockTenant(), name: "Comune di Burione" };
  const mockDelegator2 = { ...getMockTenant(), name: "Comune di Milano" };
  const mockDelegator3 = { ...getMockTenant(), name: "DeleganteTre" };

  const defaultQuery = {
    delegatorName: "Comune",
    offset: 0,
    limit: 10,
  };

  const mockDelegators = {
    results: [mockDelegator1, mockDelegator2, mockDelegator3],
    totalCount: 3,
  };

  const apiDelegators = delegationApi.CompactTenants.parse({
    results: mockDelegators.results.map(tenantToApiCompactTenant),
    totalCount: mockDelegators.totalCount,
  });

  beforeEach(() => {
    delegationService.getConsumerDelegatorsWithAgreements = vi
      .fn()
      .mockResolvedValue(apiDelegators);
  });

  const makeRequest = async (
    token: string,
    query: typeof defaultQuery = defaultQuery
  ) =>
    request(api)
      .get("/consumer/delegatorsWithAgreements")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query(query);

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.API_ROLE,
    authRole.SECURITY_ROLE,
    authRole.M2M_ROLE,
    authRole.SUPPORT_ROLE,
  ];

  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiDelegators);
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
    { query: {} },
    { query: { offset: 0 } },
    { query: { limit: 10 } },
    { query: { offset: -1, limit: 10 } },
    { query: { offset: 0, limit: -2 } },
    { query: { offset: 0, limit: 55 } },
    { query: { offset: "invalid", limit: 10 } },
    { query: { offset: 0, limit: "invalid" } },
  ])("Should return 400 if passed invalid data: %s", async ({ query }) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, query as typeof defaultQuery);
    expect(res.status).toBe(400);
  });
});
