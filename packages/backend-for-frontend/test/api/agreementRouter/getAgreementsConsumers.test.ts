/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateId } from "pagopa-interop-models";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { authRole } from "pagopa-interop-commons";
import { api, clients } from "../../vitest.api.setup.js";
import { getMockAgreementApiCompactOrganization } from "../../mockUtils.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { toBffCompactOrganization } from "../../../src/api/agreementApiConverter.js";

describe("API GET /agreements/filter/consumers", () => {
  const defaultQuery = {
    offset: 0,
    limit: 5,
  };
  const mockCompactOrganizations = {
    results: [
      getMockAgreementApiCompactOrganization(),
      getMockAgreementApiCompactOrganization(),
      getMockAgreementApiCompactOrganization(),
    ],
    totalCount: 3,
  };
  const mockApiCompactOrganizations = {
    results: mockCompactOrganizations.results.map((o) =>
      toBffCompactOrganization(o)
    ),
    pagination: {
      offset: defaultQuery.offset,
      limit: defaultQuery.limit,
      totalCount: 3,
    },
  };

  const makeRequest = async (
    token: string,
    query: typeof defaultQuery = defaultQuery
  ) =>
    request(api)
      .get(`${appBasePath}/agreements/filter/consumers`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query(query)
      .send();

  beforeEach(() => {
    clients.agreementProcessClient.getAgreementsConsumers = vi
      .fn()
      .mockResolvedValue(mockCompactOrganizations);
  });

  it("Should return 200 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockApiCompactOrganizations);
  });

  it.each([
    { query: {} },
    { query: { offset: 0 } },
    { query: { limit: 10 } },
    { query: { offset: -1, limit: 10 } },
    { query: { offset: 0, limit: -1 } },
    { query: { offset: 0, limit: 51 } },
    { query: { offset: "invalid", limit: 10 } },
    { query: { offset: 0, limit: "invalid" } },
  ])(
    "Should return 400 if passed an invalid parameter: %s",
    async ({ query }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, query as typeof defaultQuery);
      expect(res.status).toBe(400);
    }
  );
});
