/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateId } from "pagopa-interop-models";
import request from "supertest";
import { bffApi } from "pagopa-interop-api-clients";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { authRole } from "pagopa-interop-commons";
import { api, clients } from "../../vitest.api.setup.js";
import {
  getMockAgreementApiCompactEService,
  toBffCompactEServiceLight,
} from "../../mockUtils.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("API GET /consumers/agreements/eservices", () => {
  const defaultQuery = {
    offset: 0,
    limit: 5,
  };
  const mockCompactEServices = {
    results: [
      getMockAgreementApiCompactEService(),
      getMockAgreementApiCompactEService(),
      getMockAgreementApiCompactEService(),
    ],
    totalCount: 3,
  };
  const mockCompactEServicesLight = {
    results: mockCompactEServices.results.map(toBffCompactEServiceLight),
    pagination: {
      offset: defaultQuery.offset,
      limit: defaultQuery.limit,
      totalCount: 3,
    },
  };

  const apiCompactEServicesLight = bffApi.CompactEServicesLight.parse(
    mockCompactEServicesLight
  );

  const makeRequest = async (
    token: string,
    query: typeof defaultQuery = defaultQuery
  ) =>
    request(api)
      .get(`${appBasePath}/consumers/agreements/eservices`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query(query)
      .send();

  beforeEach(() => {
    clients.agreementProcessClient.getAgreementsEServices = vi
      .fn()
      .mockResolvedValue(mockCompactEServices);
  });

  it("Should return 200 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(apiCompactEServicesLight);
  });

  it.each([
    { query: {} },
    { query: { offset: 0 } },
    { query: { limit: 10 } },
    { query: { offset: -1, limit: 10 } },
    { query: { offset: 0, limit: -1 } },
    { query: { offset: 0, limit: 51 } },
    { query: { offset: "invalid", limit: 10 } },
    { query: { offset: 0, limit: "invalid" } },
  ])(
    "Should return 400 if passed an invalid parameter: %s",
    async ({ query }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, query as typeof defaultQuery);
      expect(res.status).toBe(400);
    }
  );
});
