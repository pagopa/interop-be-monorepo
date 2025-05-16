/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EServiceTemplateId, generateId } from "pagopa-interop-models";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { authRole } from "pagopa-interop-commons";
import { api, services } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getApiMockEServiceTemplateInstance } from "../../mockUtils.js";
import { eserviceTemplateNotFound } from "../../../src/model/errors.js";

describe("API GET /templates/:templateId/eservices", () => {
  const mockTemplateId = generateId<EServiceTemplateId>();
  const mockTemplateInstance1 = getApiMockEServiceTemplateInstance();
  const mockTemplateInstance2 = getApiMockEServiceTemplateInstance();
  const mockTemplateInstance3 = getApiMockEServiceTemplateInstance();
  const mockTemplateInstances = {
    results: [
      mockTemplateInstance1,
      mockTemplateInstance2,
      mockTemplateInstance3,
    ],
    pagination: {
      limit: 10,
      offset: 0,
      totalCount: 3,
    },
  };

  const makeRequest = async (token: string, limit: unknown = 10) =>
    request(api)
      .get(`${appBasePath}/templates/${mockTemplateId}/eservices`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query({ offset: 0, limit })
      .send();

  beforeEach(() => {
    services.catalogService.getEServiceTemplateInstances = vi
      .fn()
      .mockResolvedValue(mockTemplateInstances);
  });

  it("Should return 200 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockTemplateInstances);
  });

  it("Should return 404 for eserviceTemplateNotFound", async () => {
    services.catalogService.getEServiceTemplateInstances = vi
      .fn()
      .mockRejectedValue(eserviceTemplateNotFound(mockTemplateId));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 400 if passed an invalid parameter", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid");
    expect(res.status).toBe(400);
  });
});
