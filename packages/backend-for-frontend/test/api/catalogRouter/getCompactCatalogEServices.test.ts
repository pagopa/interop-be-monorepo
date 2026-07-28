/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { generateId } from "pagopa-interop-models";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { appBasePath } from "../../../src/config/appBasePath.js";
import { tenantNotFound } from "../../../src/model/errors.js";
import { getMockBffApiCompactCatalogEService } from "../../mockUtils.js";
import { api, services } from "../../vitest.api.setup.js";

describe("API GET /catalog/eservices", () => {
  const defaultQuery = {
    offset: 0,
    limit: 5,
  };
  const mockApiCompactCatalogEServices = {
    results: [
      getMockBffApiCompactCatalogEService(),
      getMockBffApiCompactCatalogEService(),
      getMockBffApiCompactCatalogEService(),
    ],
    pagination: {
      offset: defaultQuery.offset,
      limit: defaultQuery.limit,
      totalCount: 3,
    },
  };

  beforeEach(() => {
    services.catalogService.getCompactCatalogEServices = vi
      .fn()
      .mockResolvedValue(mockApiCompactCatalogEServices);
  });

  const makeRequest = async (
    token: string,
    query: typeof defaultQuery = defaultQuery
  ) =>
    request(api)
      .get(`${appBasePath}/catalog/eservices`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query(query)
      .send();

  it("Should return 200 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockApiCompactCatalogEServices);
  });

  it("Should reject a payload containing fields excluded from the compact contract", async () => {
    services.catalogService.getCompactCatalogEServices = vi
      .fn()
      .mockResolvedValue({
        ...mockApiCompactCatalogEServices,
        results: mockApiCompactCatalogEServices.results.map((result) => ({
          ...result,
          description: "a description",
          isMine: true,
          hasUnreadNotifications: true,
          asyncExchange: true,
        })),
      });
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(500);
  });

  it("Should forward all the supported filters to the service", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, {
      ...defaultQuery,
      q: "eservice name",
      states: "PUBLISHED,SUSPENDED",
      agreementStates: "ACTIVE",
      mode: "DELIVER",
      isConsumerDelegable: true,
      personalData: "TRUE",
    } as unknown as typeof defaultQuery);

    expect(res.status).toBe(200);
    expect(
      services.catalogService.getCompactCatalogEServices
    ).toHaveBeenCalledWith(expect.anything(), {
      offset: defaultQuery.offset,
      limit: defaultQuery.limit,
      q: "eservice name",
      name: "eservice name",
      states: ["PUBLISHED", "SUSPENDED"],
      agreementStates: ["ACTIVE"],
      mode: "DELIVER",
      isConsumerDelegable: true,
      personalData: "TRUE",
      eservicesIds: [],
      producersIds: [],
      attributesIds: [],
      consumersIds: [],
      templatesIds: [],
    });
  });

  it("Should accept a limit up to 200", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, { offset: 0, limit: 200 });
    expect(res.status).toBe(200);
  });

  it.each([
    authRole.ADMIN_ROLE,
    authRole.API_ROLE,
    authRole.SECURITY_ROLE,
    authRole.SUPPORT_ROLE,
    authRole.REVIEWER_ROLE,
    authRole.VIEWER_ROLE,
  ])("Should return 200 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
  });

  it("Should return 500 for 'tenantNotFound'", async () => {
    services.catalogService.getCompactCatalogEServices = vi
      .fn()
      .mockRejectedValue(tenantNotFound(generateId()));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(500);
  });

  it.each([
    { query: {} },
    { query: { offset: 0 } },
    { query: { limit: 10 } },
    { query: { offset: -1, limit: 10 } },
    { query: { offset: 0, limit: -2 } },
    { query: { offset: 0, limit: 201 } },
    { query: { offset: "invalid", limit: 10 } },
    { query: { offset: 0, limit: "invalid" } },
    { query: { ...defaultQuery, states: "invalid" } },
    { query: { ...defaultQuery, agreementStates: "invalid" } },
    { query: { ...defaultQuery, mode: "invalid" } },
    { query: { ...defaultQuery, personalData: "invalid" } },
  ])(
    "Should return 400 if passed an invalid parameter $query",
    async ({ query }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, query as typeof defaultQuery);
      expect(res.status).toBe(400);
    }
  );
});
