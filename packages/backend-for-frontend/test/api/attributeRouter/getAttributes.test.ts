/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { attributeRegistryApi, bffApi } from "pagopa-interop-api-clients";
import { api, clients } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockBffApiAttribute } from "../../mockUtils.js";
import { toCompactAttribute } from "../../../src/api/attributeApiConverter.js";

describe("API GET /attributes", () => {
  const defaultQuery = {
    offset: 0,
    limit: 5,
    kinds: ["CERTIFIED", "VERIFIED", "DECLARED"],
  };
  const mockAttributes: attributeRegistryApi.Attributes = {
    results: [
      getMockBffApiAttribute("CERTIFIED"),
      getMockBffApiAttribute("VERIFIED"),
      getMockBffApiAttribute("DECLARED"),
    ],
    totalCount: 3,
  };
  const mockResponse: bffApi.Attributes = {
    results: mockAttributes.results.map(toCompactAttribute),
    pagination: {
      offset: defaultQuery.offset,
      limit: defaultQuery.limit,
      totalCount: mockAttributes.results.length,
    },
  };

  beforeEach(() => {
    clients.attributeProcessClient.getAttributes = vi
      .fn()
      .mockResolvedValue(mockAttributes);
  });

  const makeRequest = async (
    token: string,
    query: typeof defaultQuery = defaultQuery
  ) =>
    request(api)
      .get(`${appBasePath}/attributes`)
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
    { query: { ...defaultQuery, offset: undefined } },
    { query: { ...defaultQuery, limit: undefined } },
    { query: { ...defaultQuery, offset: "invalid" } },
    { query: { ...defaultQuery, limit: "invalid" } },
    { query: { ...defaultQuery, kinds: "invalid" } },
    { query: { ...defaultQuery, kinds: ["invalid"] } },
  ])("Should return 400 if passed an invalid data: %s", async ({ query }) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, query as typeof defaultQuery);
    expect(res.status).toBe(400);
  });
});
