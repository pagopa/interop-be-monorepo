/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, services } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { delegationNotFound } from "../../../src/model/errors.js";
import { getMockBffApiCompactDelegation } from "../../mockUtils.js";

describe("API GET /delegations", () => {
  const defaultQuery = {
    offset: 0,
    limit: 5,
  };
  const mockCompactDelegations = {
    results: [
      getMockBffApiCompactDelegation(),
      getMockBffApiCompactDelegation(),
      getMockBffApiCompactDelegation(),
    ],
    pagination: {
      offset: defaultQuery.offset,
      limit: defaultQuery.limit,
      totalCount: 3,
    },
  };

  beforeEach(() => {
    services.delegationService.getDelegations = vi
      .fn()
      .mockResolvedValue(mockCompactDelegations);
  });

  const makeRequest = async (token: string, query: object = defaultQuery) =>
    request(api)
      .get(`${appBasePath}/delegations`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query(query);

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockCompactDelegations);
  });

  it("Should return 404 for delegationNotFound", async () => {
    services.delegationService.getDelegations = vi
      .fn()
      .mockRejectedValue(delegationNotFound(generateId()));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it.each([
    { query: {} },
    { query: { offset: 0 } },
    { query: { limit: 5 } },
    { query: { ...defaultQuery, offset: "invalid" } },
    { query: { ...defaultQuery, limit: "invalid" } },
  ])("Should return 400 if passed an invalid data: %s", async ({ query }) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, query);
    expect(res.status).toBe(400);
  });
});
