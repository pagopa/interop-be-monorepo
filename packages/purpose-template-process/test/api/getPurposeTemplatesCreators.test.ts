/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { generateId } from "pagopa-interop-models";
import { generateToken, getMockTenant } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { purposeTemplateApi } from "pagopa-interop-api-clients";
import { api, purposeTemplateService } from "../vitest.api.setup.js";

describe("API GET /creators test", () => {
  const tenant1: purposeTemplateApi.CompactOrganization =
    purposeTemplateApi.CompactOrganization.strip().parse({
      ...getMockTenant(),
      name: "Tenant 1",
    });
  const tenant2: purposeTemplateApi.CompactOrganization =
    purposeTemplateApi.CompactOrganization.strip().parse({
      ...getMockTenant(),
      name: "Tenant 2",
    });
  const tenant3: purposeTemplateApi.CompactOrganization =
    purposeTemplateApi.CompactOrganization.strip().parse({
      ...getMockTenant(),
      name: "Tenant 3",
    });

  type DefaultQuery = { offset: number; limit: number; name: string };

  const mockResponse = {
    results: [tenant1, tenant2, tenant3],
    totalCount: 3,
  };

  const queryParams = {
    limit: 10,
    offset: 0,
  };

  const makeRequest = async (
    token: string,
    query: typeof queryParams = queryParams
  ) =>
    request(api)
      .get("/creators")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query(query)
      .send();

  beforeEach(() => {
    purposeTemplateService.getPublishedPurposeTemplateCreators = vi
      .fn()
      .mockResolvedValue(mockResponse);
  });

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.API_ROLE,
    authRole.SECURITY_ROLE,
    authRole.SUPPORT_ROLE,
  ];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      const expected = mockResponse;

      expect(res.body).toEqual(expected);
      expect(res.status).toBe(200);
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
  ])("Should return 400 if passed invalid data: %s", async ({ query }) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, query as DefaultQuery);
    expect(res.status).toBe(400);
  });
});
