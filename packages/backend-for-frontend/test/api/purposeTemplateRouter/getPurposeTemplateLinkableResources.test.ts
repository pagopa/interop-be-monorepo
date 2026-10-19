/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { bffApi } from "pagopa-interop-api-clients";
import { authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import { generateId, PurposeTemplateId } from "pagopa-interop-models";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { appBasePath } from "../../../src/config/appBasePath.js";
import {
  eserviceDescriptorNotFound,
  eserviceTemplateNotFound,
  eserviceTemplateVersionNotFound,
  eServiceNotFound,
  tenantNotFound,
} from "../../../src/model/errors.js";
import {
  getMockBffApiLinkableEService,
  getMockBffApiLinkableEServiceTemplate,
} from "../../mockUtils.js";
import { api, services } from "../../vitest.api.setup.js";

describe("API GET /purposeTemplates/:purposeTemplateId/linkableResources", () => {
  const mockPurposeTemplateId = generateId<PurposeTemplateId>();
  const concrete1 = getMockBffApiLinkableEService(mockPurposeTemplateId);
  const concrete2 = getMockBffApiLinkableEService(mockPurposeTemplateId);
  const template1 = getMockBffApiLinkableEServiceTemplate(
    mockPurposeTemplateId
  );
  const template2 = getMockBffApiLinkableEServiceTemplate(
    mockPurposeTemplateId
  );

  const defaultQuery = {
    q: "test",
    publisherIds: `${generateId()},${generateId()}`,
    offset: 0,
    limit: 10,
  };

  const mockResponse: bffApi.LinkableResources = {
    results: [concrete1, template1, concrete2, template2],
    pagination: { offset: 0, limit: 10, totalCount: 4 },
  };

  beforeEach(() => {
    services.purposeTemplateService.getPurposeTemplateLinkableResources = vi
      .fn()
      .mockResolvedValue(mockResponse);
  });

  const makeRequest = async (
    token: string,
    query: typeof defaultQuery = defaultQuery,
    purposeTemplateId: string = mockPurposeTemplateId
  ) =>
    request(api)
      .get(
        `${appBasePath}/purposeTemplates/${purposeTemplateId}/linkableResources`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query(query);

  it("Should return 200 with mixed kinds (concrete + template) in results", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockResponse);
    expect(
      res.body.results.map((r: { resourceKind: string }) => r.resourceKind)
    ).toEqual([
      "ESERVICE",
      "ESERVICE_TEMPLATE",
      "ESERVICE",
      "ESERVICE_TEMPLATE",
    ]);
  });

  it("Should return 200 with empty results", async () => {
    services.purposeTemplateService.getPurposeTemplateLinkableResources = vi
      .fn()
      .mockResolvedValue({
        results: [],
        pagination: { offset: 0, limit: 10, totalCount: 0 },
      } satisfies bffApi.LinkableResources);

    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([]);
    expect(res.body.pagination.totalCount).toBe(0);
  });

  it("Should forward q, publisherIds, offset, limit to the service", async () => {
    const spy = vi.fn().mockResolvedValue(mockResponse);
    services.purposeTemplateService.getPurposeTemplateLinkableResources = spy;
    const publisher1 = generateId();
    const publisher2 = generateId();
    const token = generateToken(authRole.ADMIN_ROLE);

    await makeRequest(token, {
      q: "alpha",
      publisherIds: `${publisher1},${publisher2}`,
      offset: 5,
      limit: 20,
    });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        purposeTemplateId: mockPurposeTemplateId,
        q: "alpha",
        publisherIds: [publisher1, publisher2],
        offset: 5,
        limit: 20,
      })
    );
  });

  it.each([
    { error: tenantNotFound(generateId()), expectedStatus: 404 },
    { error: eServiceNotFound(generateId()), expectedStatus: 404 },
    {
      error: eserviceDescriptorNotFound(generateId(), generateId()),
      expectedStatus: 404,
    },
    { error: eserviceTemplateNotFound(generateId()), expectedStatus: 404 },
    {
      error: eserviceTemplateVersionNotFound(generateId(), generateId()),
      expectedStatus: 404,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      services.purposeTemplateService.getPurposeTemplateLinkableResources = vi
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
    { query: { ...defaultQuery, q: [1, 2, 3] } },
    { query: { ...defaultQuery, publisherIds: `${generateId()},invalid` } },
  ])("Should return 400 if passed invalid data: %s", async ({ query }) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, query as typeof defaultQuery);
    expect(res.status).toBe(400);
  });
});
