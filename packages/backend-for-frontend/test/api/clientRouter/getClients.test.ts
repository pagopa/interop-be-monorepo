/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { bffApi } from "pagopa-interop-api-clients";
import { api, services } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockBffApiCompactClient } from "../../mockUtils.js";

describe("API GET /clients", () => {
  const defaultQuery = {
    offset: 0,
    limit: 5,
  };
  const mockApiClients: bffApi.CompactClients = {
    results: [
      getMockBffApiCompactClient(),
      getMockBffApiCompactClient(),
      getMockBffApiCompactClient(),
    ],
    pagination: {
      offset: defaultQuery.offset,
      limit: defaultQuery.limit,
      totalCount: 3,
    },
  };

  beforeEach(() => {
    services.clientService.getClients = vi
      .fn()
      .mockResolvedValue(mockApiClients);
  });

  const makeRequest = async (
    token: string,
    query: typeof defaultQuery = defaultQuery
  ) =>
    request(api)
      .get(`${appBasePath}/clients`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query(query);

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockApiClients);
  });

  it.each([
    { query: {} },
    { query: { offset: 0 } },
    { query: { limit: 5 } },
    { query: { ...defaultQuery, offset: "invalid" } },
    { query: { ...defaultQuery, limit: "invalid" } },
  ])("Should return 400 if passed an invalid data: %s", async ({ query }) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(
      token,
      query as unknown as typeof defaultQuery
    );
    expect(res.status).toBe(400);
  });
});
