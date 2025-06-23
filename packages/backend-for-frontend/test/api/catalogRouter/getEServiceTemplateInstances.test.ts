/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EServiceTemplateId, generateId } from "pagopa-interop-models";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { authRole } from "pagopa-interop-commons";
import { api, services } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockBffApiEServiceTemplateInstance } from "../../mockUtils.js";
import { eserviceTemplateNotFound } from "../../../src/model/errors.js";

describe("API GET /templates/:templateId/eservices", () => {
  const defaultQuery = {
    offset: 0,
    limit: 10,
  };
  const mockTemplateInstances = {
    results: [
      getMockBffApiEServiceTemplateInstance(),
      getMockBffApiEServiceTemplateInstance(),
      getMockBffApiEServiceTemplateInstance(),
    ],
    pagination: {
      offset: defaultQuery.offset,
      limit: defaultQuery.limit,
      totalCount: 3,
    },
  };

  beforeEach(() => {
    services.catalogService.getEServiceTemplateInstances = vi
      .fn()
      .mockResolvedValue(mockTemplateInstances);
  });

  const makeRequest = async (
    token: string,
    templateId: EServiceTemplateId = generateId(),
    query: object = defaultQuery
  ) =>
    request(api)
      .get(`${appBasePath}/templates/${templateId}/eservices`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query(query)
      .send();

  it("Should return 200 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockTemplateInstances);
  });

  it("Should return 404 for eserviceTemplateNotFound", async () => {
    services.catalogService.getEServiceTemplateInstances = vi
      .fn()
      .mockRejectedValue(eserviceTemplateNotFound(generateId()));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it.each([
    { templateId: "invalid" as EServiceTemplateId },
    { query: {} },
    { query: { offset: 0 } },
    { query: { limit: 10 } },
    { query: { offset: -1, limit: 10 } },
    { query: { offset: 0, limit: -2 } },
    { query: { offset: 0, limit: 55 } },
    { query: { offset: "invalid", limit: 10 } },
    { query: { offset: 0, limit: "invalid" } },
  ])(
    "Should return 400 if passed an invalid parameter: %s",
    async ({ templateId, query }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, templateId, query);
      expect(res.status).toBe(400);
    }
  );
});
