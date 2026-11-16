/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import { generateId } from "pagopa-interop-models";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockBffApiPurpose } from "../../mockUtils.js";
import { api, services } from "../../vitest.api.setup.js";

describe("API GET /purposes/riskAnalysis/assignments test", () => {
  const defaultQuery = {
    offset: 0,
    limit: 10,
  };
  const mockPurposes = {
    results: [getMockBffApiPurpose(), getMockBffApiPurpose()],
    pagination: {
      offset: defaultQuery.offset,
      limit: defaultQuery.limit,
      totalCount: 2,
    },
  };

  beforeEach(() => {
    services.purposeService.getRiskAnalysisAssignments = vi
      .fn()
      .mockResolvedValue(mockPurposes);
  });

  const makeRequest = async (
    token: string,
    query: typeof defaultQuery = defaultQuery
  ) =>
    request(api)
      .get(`${appBasePath}/purposes/riskAnalysis/assignments`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query(query)
      .send();

  it("Should return 200 for user with role Reviewer", async () => {
    const token = generateToken(authRole.REVIEWER_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockPurposes);
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
    { query: { offset: 0, limit: 10, signingStates: ["INVALID"] } },
    { query: { offset: 0, limit: 10, eservicesIds: ["invalid"] } },
  ])(
    "Should return 400 if passed an invalid parameter: %s",
    async ({ query }) => {
      const token = generateToken(authRole.REVIEWER_ROLE);
      const res = await makeRequest(token, query as typeof defaultQuery);
      expect(res.status).toBe(400);
    }
  );
});
