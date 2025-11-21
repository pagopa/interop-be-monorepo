/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { generateToken } from "pagopa-interop-commons-test";
import { generateId, PurposeTemplateId } from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { bffApi } from "pagopa-interop-api-clients";
import request from "supertest";
import { authRole } from "pagopa-interop-commons";
import { getMockBffApiEServiceDescriptorPurposeTemplateWithCompactEServiceAndDescriptor } from "../../mockUtils.js";
import { api, services } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import {
  eserviceDescriptorNotFound,
  eServiceNotFound,
  tenantNotFound,
} from "../../../src/model/errors.js";

describe("API GET /purposeTemplates/:purposeTemplateId/eservices", () => {
  const mockPurposeTemplateId = generateId<PurposeTemplateId>();
  const purposeTemplateEServiceDescriptor1 =
    getMockBffApiEServiceDescriptorPurposeTemplateWithCompactEServiceAndDescriptor(
      mockPurposeTemplateId
    );
  const purposeTemplateEServiceDescriptor2 =
    getMockBffApiEServiceDescriptorPurposeTemplateWithCompactEServiceAndDescriptor(
      mockPurposeTemplateId
    );
  const purposeTemplateEServiceDescriptor3 =
    getMockBffApiEServiceDescriptorPurposeTemplateWithCompactEServiceAndDescriptor(
      mockPurposeTemplateId
    );

  const defaultQuery = {
    eserviceName: "Test E-Service",
    producerIds: `${generateId()},${generateId()}`,
    offset: 0,
    limit: 10,
  };

  const mockPurposeTemplateEServiceDescriptors: bffApi.EServiceDescriptorsPurposeTemplate =
    {
      results: [
        purposeTemplateEServiceDescriptor1,
        purposeTemplateEServiceDescriptor2,
        purposeTemplateEServiceDescriptor3,
      ],
      pagination: {
        offset: 0,
        limit: 10,
        totalCount: 3,
      },
    };

  beforeEach(() => {
    services.purposeTemplateService.getPurposeTemplateEServiceDescriptors = vi
      .fn()
      .mockResolvedValue(mockPurposeTemplateEServiceDescriptors);
  });

  const makeRequest = async (
    token: string,
    query: typeof defaultQuery = defaultQuery,
    purposeTemplateId: string = mockPurposeTemplateId
  ) =>
    request(api)
      .get(`${appBasePath}/purposeTemplates/${purposeTemplateId}/eservices`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query(query);

  it("Should return 200 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockPurposeTemplateEServiceDescriptors);
  });

  it.each([
    { error: tenantNotFound(generateId()), expectedStatus: 404 },
    {
      error: eServiceNotFound(generateId()),
      expectedStatus: 404,
    },
    {
      error: eserviceDescriptorNotFound(generateId(), generateId()),
      expectedStatus: 404,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      services.purposeTemplateService.getPurposeTemplateEServiceDescriptors = vi
        .fn()
        .mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    { query: {} },
    { query: { offset: 0 } },
    { query: { limit: 10 } },
    { query: { offset: -1, limit: 10 } },
    { query: { offset: 0, limit: -2 } },
    { query: { offset: 0, limit: 55 } },
    { query: { offset: "invalid", limit: 10 } },
    { query: { offset: 0, limit: "invalid" } },
    { query: { ...defaultQuery, eserviceName: [1, 2, 3] } },
    { query: { ...defaultQuery, producerIds: `${generateId()},invalid` } },
  ])("Should return 400 if passed invalid data: %s", async ({ query }) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, query as typeof defaultQuery);
    expect(res.status).toBe(400);
  });
});
