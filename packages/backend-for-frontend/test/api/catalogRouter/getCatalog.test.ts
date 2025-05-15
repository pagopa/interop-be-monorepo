/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DescriptorId,
  generateId,
  RiskAnalysisId,
  TenantId,
} from "pagopa-interop-models";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { authRole } from "pagopa-interop-commons";

import {
  eserviceDescriptorNotFound,
  eserviceRiskNotFound,
  invalidEServiceRequester,
} from "../../../src/model/errors.js";
import { api, services } from "../../vitest.api.setup.js";
import { getMockApiCatalogEService } from "../../mockUtils.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("API GET /catalog", () => {
  const mockApiCatalogEService1 = getMockApiCatalogEService();
  const mockApiCatalogEService2 = getMockApiCatalogEService();
  const mockApiCatalogEService3 = getMockApiCatalogEService();

  const mockApiCatalogEServices = {
    results: [
      mockApiCatalogEService1,
      mockApiCatalogEService2,
      mockApiCatalogEService3,
    ],
    pagination: {
      offset: 0,
      limit: 10,
      totalCount: 3,
    },
  };

  const makeRequest = async (token: string, limit: unknown = 10) =>
    request(api)
      .get(`${appBasePath}/catalog`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query({
        offset: 0,
        limit,
      })
      .send();

  beforeEach(() => {
    services.catalogService.getCatalog = vi
      .fn()
      .mockResolvedValue(mockApiCatalogEServices);
  });

  it("Should return 200 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockApiCatalogEServices);
  });

  it.each([
    {
      error: eserviceRiskNotFound(
        mockApiCatalogEService1.id,
        generateId<RiskAnalysisId>()
      ),
      expectedStatus: 404,
    },
    {
      error: eserviceDescriptorNotFound(
        mockApiCatalogEService1.id,
        generateId<DescriptorId>()
      ),
      expectedStatus: 404,
    },
    {
      error: invalidEServiceRequester(
        mockApiCatalogEService1.id,
        generateId<TenantId>()
      ),
      expectedStatus: 403,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      services.catalogService.getCatalog = vi.fn().mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it("Should return 400 if passed an invalid parameter", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid");
    expect(res.status).toBe(400);
  });
});
