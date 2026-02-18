/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Agreement, ListResult, generateId } from "pagopa-interop-models";
import { generateToken, getMockAgreement } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { agreementApi } from "pagopa-interop-api-clients";
import { api, agreementService } from "../vitest.api.setup.js";
import { agreementToApiAgreement } from "../../src/model/domain/apiConverter.js";

describe("API GET /agreements test", () => {
  const mockAgreement1 = getMockAgreement();
  const mockAgreement2 = getMockAgreement();
  const mockAgreement3 = getMockAgreement();

  const defaultQuery = {
    offset: 0,
    limit: 10,
    states: "DRAFT,ACTIVE",
    eservicesIds: generateId(),
    consumersIds: `${generateId()},${generateId()}`,
    producersIds: `${generateId()},${generateId()}`,
    descriptorsIds: `${generateId()},${generateId()}`,
  };

  const agreements: ListResult<Agreement> = {
    results: [mockAgreement1, mockAgreement2, mockAgreement3],
    totalCount: 3,
  };

  const apiResponse = agreementApi.Agreements.parse({
    results: agreements.results.map((agreement) =>
      agreementToApiAgreement(agreement)
    ),
    totalCount: agreements.totalCount,
  });

  beforeEach(() => {
    agreementService.getAgreements = vi.fn().mockResolvedValue(agreements);
  });

  const makeRequest = async (
    token: string,
    query: typeof defaultQuery = defaultQuery
  ) =>
    request(api)
      .get("/agreements")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query(query);

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.API_ROLE,
    authRole.SECURITY_ROLE,
    authRole.M2M_ROLE,
    authRole.M2M_ADMIN_ROLE,
    authRole.SUPPORT_ROLE,
  ];

  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiResponse);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it.each([
    { query: {} },
    { query: { offset: 0 } },
    { query: { limit: 10 } },
    { query: { offset: -1, limit: 10 } },
    { query: { offset: 0, limit: -2 } },
    { query: { offset: 0, limit: 55 } },
    { query: { offset: "invalid", limit: 10 } },
    { query: { offset: 0, limit: "invalid" } },
    { query: { ...defaultQuery, states: "ACTIVE,invalid" } },
    { query: { ...defaultQuery, eservicesIds: `${generateId()},invalid` } },
    { query: { ...defaultQuery, consumersIds: `${generateId()},invalid` } },
    { query: { ...defaultQuery, producersIds: `invalid,${generateId()}` } },
    { query: { ...defaultQuery, descriptorsIds: `invalid,${generateId()}` } },
  ])("Should return 400 if passed invalid data: %s", async ({ query }) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, query as typeof defaultQuery);
    expect(res.status).toBe(400);
  });
});
