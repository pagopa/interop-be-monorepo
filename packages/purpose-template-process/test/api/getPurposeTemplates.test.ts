/* eslint-disable @typescript-eslint/explicit-function-return-type */
import {
  generateToken,
  getMockPurposeTemplate,
} from "pagopa-interop-commons-test";
import {
  generateId,
  ListResult,
  PurposeTemplate,
  tenantKind,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { purposeTemplateApi } from "pagopa-interop-api-clients";
import request from "supertest";
import { authRole, AuthRole } from "pagopa-interop-commons";
import { purposeTemplateToApiPurposeTemplate } from "../../src/model/domain/apiConverter.js";
import { api, purposeTemplateService } from "../vitest.api.setup.js";

describe("API GET /purposeTemplates", () => {
  const mockPurposeTemplate1: PurposeTemplate = {
    ...getMockPurposeTemplate(),
    purposeTitle: "Mock purpose template 1",
  };
  const mockPurposeTemplate2: PurposeTemplate = {
    ...getMockPurposeTemplate(),
    purposeTitle: "Mock purpose template 2",
  };
  const mockPurposeTemplate3: PurposeTemplate = {
    ...getMockPurposeTemplate(),
    purposeTitle: "Mock purpose template 3",
  };

  const defaultQuery = {
    offset: 0,
    limit: 10,
    purposeTitle: "Mock title",
    eserviceIds: generateId(),
    creatorIds: `${generateId()},${generateId()}`,
    states: "ACTIVE,DRAFT",
    excludeExpiredRiskAnalysis: false,
    targetTenantKind: tenantKind.PA,
  };

  const purposeTemplates: ListResult<PurposeTemplate> = {
    results: [mockPurposeTemplate1, mockPurposeTemplate2, mockPurposeTemplate3],
    totalCount: 3,
  };

  const apiResponse = purposeTemplateApi.PurposeTemplates.parse({
    results: purposeTemplates.results.map((purpose) =>
      purposeTemplateToApiPurposeTemplate(purpose)
    ),
    totalCount: purposeTemplates.totalCount,
  });

  beforeEach(() => {
    purposeTemplateService.getPurposeTemplates = vi
      .fn()
      .mockResolvedValue(purposeTemplates);
  });

  const makeRequest = async (
    token: string,
    query: typeof defaultQuery = defaultQuery
  ) =>
    request(api)
      .get("/purposeTemplates")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query(query);

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.API_ROLE,
    authRole.SECURITY_ROLE,
    authRole.M2M_ROLE,
    authRole.M2M_ADMIN_ROLE,
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
    { query: { ...defaultQuery, eserviceIds: `${generateId()},invalid` } },
    { query: { ...defaultQuery, creatorIds: `${generateId()},invalid` } },
    { query: { ...defaultQuery, states: "ACTIVE,invalid" } },
    { query: { ...defaultQuery, targetTenantKind: "invalid" } },
    { query: { ...defaultQuery, excludeExpiredRiskAnalysis: "invalid" } },
  ])("Should return 400 if passed invalid data: %s", async ({ query }) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, query as typeof defaultQuery);
    expect(res.status).toBe(400);
  });
});
