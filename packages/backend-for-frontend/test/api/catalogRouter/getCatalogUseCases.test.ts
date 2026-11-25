/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { generateMock } from "@anatine/zod-mock";
import { bffApi } from "pagopa-interop-api-clients";
import { authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import { generateId } from "pagopa-interop-models";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { appBasePath } from "../../../src/config/appBasePath.js";
import { tenantNotFound } from "../../../src/model/errors.js";
import { getMockBffApiCatalogEService } from "../../mockUtils.js";
import { api, services } from "../../vitest.api.setup.js";

describe("API GET /catalog/use-cases", () => {
  const mockApiCatalogUseCases: bffApi.CatalogUseCase[] = [
    {
      name: generateMock(z.string()),
      description: generateMock(z.string()),
      slug: generateMock(z.string()),
      fieldId: generateMock(bffApi.CatalogUseCaseField),
      subscribedEservices: [getMockBffApiCatalogEService()],
      unsubscribedEservices: [
        getMockBffApiCatalogEService(),
        getMockBffApiCatalogEService(),
      ],
    },
  ];

  beforeEach(() => {
    services.catalogService.getCatalogUseCases = vi
      .fn()
      .mockResolvedValue(mockApiCatalogUseCases);
  });

  const makeRequest = async (token: string, acceptLanguage?: string) => {
    const req = request(api)
      .get(`${appBasePath}/catalog/use-cases`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());
    return acceptLanguage
      ? req.set("Accept-Language", acceptLanguage).send()
      : req.send();
  };

  it("Should return 200 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockApiCatalogUseCases);
  });

  it.each([
    { acceptLanguage: "en-EN", locale: "en" },
    { acceptLanguage: "it-IT", locale: "it" },
    { acceptLanguage: undefined, locale: undefined },
  ])(
    "Should pass the locale $locale for the Accept-Language header $acceptLanguage",
    async ({ acceptLanguage, locale }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, acceptLanguage);
      expect(res.status).toBe(200);
      expect(
        services.catalogService.getCatalogUseCases
      ).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ locale }));
    }
  );

  it("Should return 200 with an empty array if there are no use cases", async () => {
    services.catalogService.getCatalogUseCases = vi.fn().mockResolvedValue([]);
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it.each([
    { error: tenantNotFound(generateId()), expectedStatus: 500 },
    { error: new Error("generic error"), expectedStatus: 500 },
  ])(
    "Should return $expectedStatus for $error.message",
    async ({ error, expectedStatus }) => {
      services.catalogService.getCatalogUseCases = vi
        .fn()
        .mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );
});
