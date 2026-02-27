/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { bffApi, purposeTemplateApi } from "pagopa-interop-api-clients";
import { api, services } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockBffApiCreatorPurposeTemplate } from "../../mockUtils.js";

describe("API GET /creators/purposeTemplates", () => {
  const defaultQuery = {
    q: "title",
    eserviceIds: `${generateId()},${generateId()}`,
    states: `${purposeTemplateApi.PurposeTemplateState.Enum.PUBLISHED},${purposeTemplateApi.PurposeTemplateState.Enum.DRAFT}`,
    offset: 0,
    limit: 5,
  };
  const mockCreatorPurposeTemplates: bffApi.CreatorPurposeTemplates = {
    results: [
      getMockBffApiCreatorPurposeTemplate(),
      getMockBffApiCreatorPurposeTemplate(),
      getMockBffApiCreatorPurposeTemplate(),
    ],
    pagination: {
      offset: defaultQuery.offset,
      limit: defaultQuery.limit,
      totalCount: 3,
    },
  };

  beforeEach(() => {
    services.purposeTemplateService.getCreatorPurposeTemplates = vi
      .fn()
      .mockResolvedValue(mockCreatorPurposeTemplates);
  });

  const makeRequest = async (
    token: string,
    query: typeof defaultQuery = defaultQuery
  ) =>
    request(api)
      .get(`${appBasePath}/creators/purposeTemplates`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query(query);

  it("Should return 200 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockCreatorPurposeTemplates);
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
    {
      query: {
        ...defaultQuery,
        states: `${purposeTemplateApi.PurposeTemplateState.Enum.PUBLISHED},invalid`,
      },
    },
  ])("Should return 400 if passed invalid data: %s", async ({ query }) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, query as typeof defaultQuery);
    expect(res.status).toBe(400);
  });
});
