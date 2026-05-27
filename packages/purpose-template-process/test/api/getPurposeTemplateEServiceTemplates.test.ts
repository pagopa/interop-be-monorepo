/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { generateToken } from "pagopa-interop-commons-test";
import {
  EServiceTemplateVersionPurposeTemplate,
  generateId,
  ListResult,
  PurposeTemplateId,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { purposeTemplateApi } from "pagopa-interop-api-clients";
import request from "supertest";
import { authRole, AuthRole } from "pagopa-interop-commons";
import { api, purposeTemplateService } from "../vitest.api.setup.js";
import { eserviceTemplateVersionPurposeTemplateToApiEServiceTemplateVersionPurposeTemplate } from "../../src/model/domain/apiConverter.js";
import { purposeTemplateNotFound } from "../../src/model/domain/errors.js";

describe("API GET /purposeTemplates/:id/eserviceTemplates", () => {
  const purposeTemplateId = generateId<PurposeTemplateId>();
  const link1: EServiceTemplateVersionPurposeTemplate = {
    purposeTemplateId,
    eserviceTemplateId: generateId(),
    eserviceTemplateVersionId: generateId(),
    createdAt: new Date(),
  };
  const link2: EServiceTemplateVersionPurposeTemplate = {
    purposeTemplateId,
    eserviceTemplateId: generateId(),
    eserviceTemplateVersionId: generateId(),
    createdAt: new Date(),
  };
  const link3: EServiceTemplateVersionPurposeTemplate = {
    purposeTemplateId,
    eserviceTemplateId: generateId(),
    eserviceTemplateVersionId: generateId(),
    createdAt: new Date(),
  };

  const defaultQuery = {
    eserviceTemplateName: "Test E-Service Template",
    creatorIds: `${generateId()},${generateId()}`,
    offset: 0,
    limit: 10,
  };

  const eserviceTemplateVersionPurposeTemplates: ListResult<EServiceTemplateVersionPurposeTemplate> =
    {
      results: [link1, link2, link3],
      totalCount: 3,
    };

  const apiResponse =
    purposeTemplateApi.EServiceTemplateVersionsPurposeTemplate.parse({
      results: eserviceTemplateVersionPurposeTemplates.results.map(
        eserviceTemplateVersionPurposeTemplateToApiEServiceTemplateVersionPurposeTemplate
      ),
      totalCount: eserviceTemplateVersionPurposeTemplates.totalCount,
    });

  beforeEach(() => {
    purposeTemplateService.getPurposeTemplateEServiceTemplates = vi
      .fn()
      .mockResolvedValue(eserviceTemplateVersionPurposeTemplates);
  });

  const makeRequest = async (
    token: string,
    purposeTemplateId: PurposeTemplateId = generateId(),
    query: typeof defaultQuery = defaultQuery
  ) =>
    request(api)
      .get(`/purposeTemplates/${purposeTemplateId}/eserviceTemplates`)
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

  it("Should return 404 when purpose template is not found", async () => {
    const error = purposeTemplateNotFound(generateId());
    purposeTemplateService.getPurposeTemplateEServiceTemplates = vi
      .fn()
      .mockRejectedValue(error);

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
    { query: { ...defaultQuery, eserviceTemplateName: [1, 2, 3] } },
    { query: { ...defaultQuery, creatorIds: `${generateId()},invalid` } },
  ])("Should return 400 if passed invalid data: %s", async ({ query }) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(
      token,
      purposeTemplateId,
      query as typeof defaultQuery
    );
    expect(res.status).toBe(400);
  });
});
