/* eslint-disable @typescript-eslint/explicit-function-return-type */
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

describe("API GET /catalog/featured", () => {
  const mockApiCatalogEServices = [
    getMockBffApiCatalogEService(),
    getMockBffApiCatalogEService(),
    getMockBffApiCatalogEService(),
  ];

  beforeEach(() => {
    services.catalogService.getFeaturedCatalog = vi
      .fn()
      .mockResolvedValue(mockApiCatalogEServices);
  });

  const makeRequest = async (token: string) =>
    request(api)
      .get(`${appBasePath}/catalog/featured`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  it("Should return 200 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockApiCatalogEServices);
    expect(
      services.catalogService.getFeaturedCatalog
    ).toHaveBeenCalledExactlyOnceWith(expect.anything());
  });

  it("Should return 200 with an empty array if no e-service is featured", async () => {
    services.catalogService.getFeaturedCatalog = vi.fn().mockResolvedValue([]);
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

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
      services.catalogService.getFeaturedCatalog = vi
        .fn()
        .mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );
});
