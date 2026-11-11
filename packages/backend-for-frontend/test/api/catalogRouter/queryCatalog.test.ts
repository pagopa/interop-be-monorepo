/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { bffApi } from "pagopa-interop-api-clients";
import { authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import { generateId } from "pagopa-interop-models";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { appBasePath } from "../../../src/config/appBasePath.js";
import {
  eserviceDescriptorNotFound,
  eserviceRiskNotFound,
  invalidEServiceRequester,
} from "../../../src/model/errors.js";
import { getMockBffApiCatalogEService } from "../../mockUtils.js";
import { api, services } from "../../vitest.api.setup.js";

describe("API POST /catalog", () => {
  const defaultBody = {
    offset: 0,
    limit: 5,
  };
  const mockApiCatalogQueryResults: bffApi.CatalogQueryResults = {
    results: [
      { ...getMockBffApiCatalogEService(), resultType: "eservice" },
      {
        id: generateId(),
        name: "Template name",
        description: "Template description",
        numInstances: 2,
        resultType: "template",
      },
      { ...getMockBffApiCatalogEService(), resultType: "eservice" },
    ],
    pagination: {
      offset: defaultBody.offset,
      limit: defaultBody.limit,
      totalCount: 3,
    },
  };

  beforeEach(() => {
    services.catalogService.queryCatalog = vi
      .fn()
      .mockResolvedValue(mockApiCatalogQueryResults);
  });

  const makeRequest = async (
    token: string,
    body: bffApi.CatalogFilterPayload = defaultBody
  ) =>
    request(api)
      .post(`${appBasePath}/catalog`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 200 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockApiCatalogQueryResults);
  });

  it.each([undefined, false, true])(
    "Should forward groupByTemplate=%s",
    async (groupByTemplate) => {
      const body = { ...defaultBody, groupByTemplate };
      const res = await makeRequest(generateToken(authRole.ADMIN_ROLE), body);

      expect(res.status).toBe(200);
      expect(
        services.catalogService.queryCatalog
      ).toHaveBeenCalledExactlyOnceWith(expect.anything(), body);
    }
  );

  it.each([undefined, false, true])(
    "Should forward templateId with onlyTemplateInstances=%s",
    async (onlyTemplateInstances) => {
      const body = {
        ...defaultBody,
        templateId: generateId(),
        onlyTemplateInstances,
      };
      const res = await makeRequest(generateToken(authRole.ADMIN_ROLE), body);

      expect(res.status).toBe(200);
      expect(
        services.catalogService.queryCatalog
      ).toHaveBeenCalledExactlyOnceWith(expect.anything(), body);
    }
  );

  it.each([
    {
      error: eserviceRiskNotFound(generateId(), generateId()),
      expectedStatus: 404,
    },
    {
      error: eserviceDescriptorNotFound(generateId(), generateId()),
      expectedStatus: 404,
    },
    {
      error: invalidEServiceRequester(generateId(), generateId()),
      expectedStatus: 403,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      services.catalogService.queryCatalog = vi.fn().mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    { body: {} },
    { body: { offset: 0 } },
    { body: { limit: 10 } },
    { body: { offset: -1, limit: 10 } },
    { body: { offset: 0, limit: -2 } },
    { body: { offset: 0, limit: 201 } },
    { body: { offset: "invalid", limit: 10 } },
    { body: { offset: 0, limit: "invalid" } },
    { body: { ...defaultBody, sortBy: "invalid" } },
    { body: { ...defaultBody, producersIds: ["not-a-uuid"] } },
    { body: { ...defaultBody, templateId: "not-a-uuid" } },
    { body: { ...defaultBody, groupByTemplate: "yes" } },
  ])("Should return 400 if passed an invalid body $body", async ({ body }) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, body as bffApi.CatalogFilterPayload);
    expect(res.status).toBe(400);
  });
});
