/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { bffApi } from "pagopa-interop-api-clients";
import { authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import { generateId } from "pagopa-interop-models";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { appBasePath } from "../../../src/config/appBasePath.js";
import { catalogEServiceTemplatePublishedVersionNotFound } from "../../../src/model/errors.js";
import { getMockBffApiCatalogEServiceTemplate } from "../../mockUtils.js";
import { api, services } from "../../vitest.api.setup.js";

describe("API GET /catalog/eservices/templates", () => {
  const defaultQuery = {
    offset: 0,
    limit: 5,
  };
  const mockCatalogEServiceTemplates: bffApi.CatalogEServiceTemplates = {
    results: [
      getMockBffApiCatalogEServiceTemplate(),
      getMockBffApiCatalogEServiceTemplate(),
      getMockBffApiCatalogEServiceTemplate(),
    ],
    pagination: {
      offset: defaultQuery.offset,
      limit: defaultQuery.limit,
      totalCount: 3,
    },
  };

  beforeEach(() => {
    services.eServiceTemplateService.getCatalogEServiceTemplates = vi
      .fn()
      .mockResolvedValue(mockCatalogEServiceTemplates);
  });

  const makeRequest = async (
    token: string,
    query: typeof defaultQuery = defaultQuery
  ) =>
    request(api)
      .get(`${appBasePath}/catalog/eservices/templates`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query(query);

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockCatalogEServiceTemplates);
  });

  it("Should return 404 for catalogEServiceTemplatePublishedVersionNotFound", async () => {
    services.eServiceTemplateService.getCatalogEServiceTemplates = vi
      .fn()
      .mockRejectedValue(
        catalogEServiceTemplatePublishedVersionNotFound(generateId())
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
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
    { query: { ...defaultQuery, personalData: "invalid" } },
  ])("Should return 400 if passed invalid data: %s", async ({ query }) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, query as typeof defaultQuery);
    expect(res.status).toBe(400);
  });
});
