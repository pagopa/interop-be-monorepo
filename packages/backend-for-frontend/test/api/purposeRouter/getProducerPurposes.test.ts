/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import request from "supertest";
import { api, services } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockBffApiPurpose } from "../../mockUtils.js";
import {
  agreementNotFound,
  eServiceNotFound,
  eserviceDescriptorNotFound,
  tenantNotFound,
} from "../../../src/model/errors.js";

describe("API GET /producers/purposes test", () => {
  const mockPurposes: bffApi.Purposes = {
    results: [getMockBffApiPurpose(), getMockBffApiPurpose()],
    pagination: { offset: 0, limit: 10, totalCount: 20 },
  };
  const defaultQuery = {
    offset: 0,
    limit: 5,
    q: "",
    eservicesIds: generateId(),
    producersIds: `${generateId()},${generateId()}`,
    states: "ACTIVE,DRAFT",
  };

  beforeEach(() => {
    services.purposeService.getProducerPurposes = vi
      .fn()
      .mockResolvedValue(mockPurposes);
  });

  const makeRequest = async (
    token: string,
    query: typeof defaultQuery = defaultQuery
  ) =>
    request(api)
      .get(`${appBasePath}/producers/purposes`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query(query)
      .send();

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockPurposes);
  });

  it.each([
    { error: tenantNotFound(generateId()), expectedStatus: 404 },
    { error: eServiceNotFound(generateId()), expectedStatus: 404 },
    { error: agreementNotFound(generateId()), expectedStatus: 404 },
    {
      error: eserviceDescriptorNotFound(generateId(), generateId()),
      expectedStatus: 404,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      services.purposeService.getProducerPurposes = vi
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
    { query: { ...defaultQuery, eservicesIds: `${generateId()},invalid` } },
    { query: { ...defaultQuery, consumersIds: `invalid,${generateId()}` } },
    { query: { ...defaultQuery, states: "ACTIVE,invalid" } },
  ])("Should return 400 if passed invalid data: %s", async ({ query }) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, query as typeof defaultQuery);
    expect(res.status).toBe(400);
  });
});
