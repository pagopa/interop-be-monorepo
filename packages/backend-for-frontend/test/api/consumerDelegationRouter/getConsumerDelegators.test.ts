/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import request from "supertest";
import { api, clients } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockBffApiDelegationTenant } from "../../mockUtils.js";

describe("API GET /consumers/delegations/delegators", () => {
  const defaultQuery = {
    offset: 0,
    limit: 5,
  };
  const mockClientReponse = {
    results: [
      getMockBffApiDelegationTenant(),
      getMockBffApiDelegationTenant(),
      getMockBffApiDelegationTenant(),
    ],
    totalCount: 3,
  };
  const mockResponse: bffApi.DelegationTenants = {
    results: mockClientReponse.results,
    pagination: {
      offset: defaultQuery.offset,
      limit: defaultQuery.limit,
      totalCount: mockClientReponse.totalCount,
    },
  };

  beforeEach(() => {
    clients.delegationProcessClient.consumer.getConsumerDelegators = vi
      .fn()
      .mockResolvedValue(mockClientReponse);
  });

  const makeRequest = async (
    token: string,
    query: typeof defaultQuery = defaultQuery
  ) =>
    request(api)
      .get(`${appBasePath}/consumers/delegations/delegators`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query(query);

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockResponse);
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
    { query: { ...defaultQuery, eserviceIds: `${generateId()},invalid` } },
  ])("Should return 400 if passed invalid data: %s", async ({ query }) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, query as typeof defaultQuery);
    expect(res.status).toBe(400);
  });
});
