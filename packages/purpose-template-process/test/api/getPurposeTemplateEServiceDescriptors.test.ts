/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { generateToken } from "pagopa-interop-commons-test";
import {
  EServiceDescriptorPurposeTemplate,
  generateId,
  ListResult,
  PurposeTemplateId,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { purposeTemplateApi } from "pagopa-interop-api-clients";
import request from "supertest";
import { authRole, AuthRole } from "pagopa-interop-commons";
import { api, purposeTemplateService } from "../vitest.api.setup.js";
import { eserviceDescriptorPurposeTemplateToApiEServiceDescriptorPurposeTemplate } from "../../src/model/domain/apiConverter.js";

describe("API GET /purposeTemplates/:id/eservices", () => {
  const purposeTemplateId = generateId<PurposeTemplateId>();
  const purposeTemplateEServiceDescriptor1: EServiceDescriptorPurposeTemplate =
    {
      purposeTemplateId,
      eserviceId: generateId(),
      descriptorId: generateId(),
      createdAt: new Date(),
    };
  const purposeTemplateEServiceDescriptor2: EServiceDescriptorPurposeTemplate =
    {
      purposeTemplateId,
      eserviceId: generateId(),
      descriptorId: generateId(),
      createdAt: new Date(),
    };
  const purposeTemplateEServiceDescriptor3: EServiceDescriptorPurposeTemplate =
    {
      purposeTemplateId,
      eserviceId: generateId(),
      descriptorId: generateId(),
      createdAt: new Date(),
    };

  const defaultQuery = {
    eserviceIds: `${generateId()},${generateId()}`,
    producerIds: `${generateId()},${generateId()}`,
    offset: 0,
    limit: 10,
  };

  const purposeTemplateEServiceDescriptors: ListResult<EServiceDescriptorPurposeTemplate> =
    {
      results: [
        purposeTemplateEServiceDescriptor1,
        purposeTemplateEServiceDescriptor2,
        purposeTemplateEServiceDescriptor3,
      ],
      totalCount: 3,
    };

  const apiResponse =
    purposeTemplateApi.EServiceDescriptorsPurposeTemplate.parse({
      results: purposeTemplateEServiceDescriptors.results.map(
        (purposeTemplateEServiceDescriptor) =>
          eserviceDescriptorPurposeTemplateToApiEServiceDescriptorPurposeTemplate(
            purposeTemplateEServiceDescriptor
          )
      ),
      totalCount: purposeTemplateEServiceDescriptors.totalCount,
    });

  beforeEach(() => {
    purposeTemplateService.getPurposeTemplateEServiceDescriptors = vi
      .fn()
      .mockResolvedValue(purposeTemplateEServiceDescriptors);
  });

  const makeRequest = async (
    token: string,
    purposeTemplateId: PurposeTemplateId = generateId(),
    query: typeof defaultQuery = defaultQuery
  ) =>
    request(api)
      .get(`/purposeTemplates/${purposeTemplateId}/eservices`)
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
    { query: { ...defaultQuery, producerIds: `${generateId()},invalid` } },
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
