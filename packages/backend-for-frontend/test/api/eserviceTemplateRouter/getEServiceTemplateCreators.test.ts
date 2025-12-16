/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { bffApi, eserviceTemplateApi } from "pagopa-interop-api-clients";
import { api, clients } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockBffApiCompactOrganization } from "../../mockUtils.js";
import { toBffCompactOrganization } from "../../../src/api/agreementApiConverter.js";

describe("API GET /eservices/templates/filter/creators", () => {
  const defaultQuery = {
    offset: 0,
    limit: 5,
  };
  const mockTemplateApiCompactOrganizations: eserviceTemplateApi.CompactOrganizations =
    {
      results: [
        getMockBffApiCompactOrganization(),
        getMockBffApiCompactOrganization(),
        getMockBffApiCompactOrganization(),
      ],
      totalCount: 3,
    };
  const mockCompactOrganizations: bffApi.CompactOrganizations = {
    results: mockTemplateApiCompactOrganizations.results.map((o) =>
      toBffCompactOrganization(o)
    ),
    pagination: {
      offset: defaultQuery.offset,
      limit: defaultQuery.limit,
      totalCount: mockTemplateApiCompactOrganizations.totalCount,
    },
  };

  beforeEach(() => {
    clients.eserviceTemplateProcessClient.getEServiceTemplateCreators = vi
      .fn()
      .mockResolvedValue(mockTemplateApiCompactOrganizations);
  });

  const makeRequest = async (
    token: string,
    query: typeof defaultQuery = defaultQuery
  ) =>
    request(api)
      .get(`${appBasePath}/eservices/templates/filter/creators`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query(query);

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockCompactOrganizations);
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
