/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ListResult, Purpose, generateId } from "pagopa-interop-models";
import { generateToken, getMockPurpose } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { purposeApi } from "pagopa-interop-api-clients";
import { api, purposeService } from "../vitest.api.setup.js";
import { purposeToApiPurpose } from "../../src/model/domain/apiConverter.js";

describe("API GET /purposes test", () => {
  const mockPurpose1: Purpose = {
    ...getMockPurpose(),
    title: "Mock purpose 1",
  };
  const mockPurpose2: Purpose = {
    ...getMockPurpose(),
    title: "Mock purpose 2",
  };
  const mockPurpose3: Purpose = {
    ...getMockPurpose(),
    title: "Mock purpose 3",
  };

  const defaultQuery = {
    offset: 0,
    limit: 10,
    name: "Mock",
    eservicesIds: generateId(),
    consumersIds: `${generateId()},${generateId()}`,
    producersIds: `${generateId()},${generateId()}`,
    clientId: undefined,
    states: "ACTIVE,DRAFT",
    excludeDraft: false,
  };

  const purposes: ListResult<Purpose> = {
    results: [mockPurpose1, mockPurpose2, mockPurpose3],
    totalCount: 3,
  };

  const apiResponse = purposeApi.Purposes.parse({
    results: purposes.results.map((purpose) =>
      purposeToApiPurpose(purpose, false)
    ),
    totalCount: purposes.totalCount,
  });

  beforeEach(() => {
    purposeService.getPurposes = vi.fn().mockResolvedValue(purposes);
  });

  const makeRequest = async (
    token: string,
    query: typeof defaultQuery = defaultQuery
  ) =>
    request(api)
      .get("/purposes")
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
    { query: { ...defaultQuery, eservicesIds: `${generateId()},invalid` } },
    { query: { ...defaultQuery, consumersIds: `${generateId()},invalid` } },
    { query: { ...defaultQuery, producersIds: `invalid,${generateId()}` } },
    { query: { ...defaultQuery, clientId: `invalid,${generateId()}` } },
    { query: { ...defaultQuery, states: "ACTIVE,invalid" } },
    { query: { ...defaultQuery, excludeDraft: "invalid" } },
  ])("Should return 400 if passed invalid data: %s", async ({ query }) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, query as typeof defaultQuery);
    expect(res.status).toBe(400);
  });
});
