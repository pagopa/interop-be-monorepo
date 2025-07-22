/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ListResult, generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { agreementApi } from "pagopa-interop-api-clients";
import { api, agreementService } from "../vitest.api.setup.js";

describe("API GET /agreements/filter/eservices test", () => {
  const mockEService1 = { id: generateId(), name: "eService 1" };
  const mockEService2 = { id: generateId(), name: "eService 2" };

  const defaultQuery = {
    offset: 0,
    limit: 10,
    eServiceName: "eService",
    consumersIds: `${generateId()},${generateId()}`,
    producersIds: `${generateId()},${generateId()}`,
  };

  const eServices: ListResult<agreementApi.CompactOrganization> = {
    results: [mockEService1, mockEService2],
    totalCount: 2,
  };

  const apiResponse = agreementApi.CompactEServices.parse({
    results: eServices.results,
    totalCount: eServices.totalCount,
  });

  beforeEach(() => {
    agreementService.getAgreementsEServices = vi
      .fn()
      .mockResolvedValue(eServices);
  });

  const makeRequest = async (
    token: string,
    query: typeof defaultQuery = defaultQuery
  ) =>
    request(api)
      .get("/agreements/filter/eservices")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query(query);

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
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiResponse);
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
    { query: { ...defaultQuery, consumersIds: `${generateId()},invalid` } },
    { query: { ...defaultQuery, producersIds: `invalid,${generateId()}` } },
  ])("Should return 400 if passed invalid data: %s", async ({ query }) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, query as typeof defaultQuery);
    expect(res.status).toBe(400);
  });
});
