/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { delegationApi } from "pagopa-interop-api-clients";
import {
  generateToken,
  getMockEService,
  getMockTenant,
} from "pagopa-interop-commons-test";
import { generateId } from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";

import { api, delegationService } from "../vitest.api.setup.js";
import { eserviceToApiCompactEservice } from "../mockUtils.js";

describe("API GET /consumer/eservices test", () => {
  const mockDelegator = { ...getMockTenant(), name: "Comune di Burione" };
  const mockEservice1 = { ...getMockEService(), name: "Servizio 1" };
  const mockEservice2 = { ...getMockEService(), name: "Servizio 2" };
  const mockEservice3 = { ...getMockEService(), name: "Servizio 3" };

  const defaultQuery = {
    eserviceName: "Servizio",
    delegatorId: mockDelegator.id,
    offset: 0,
    limit: 10,
  };

  const mockEservices = {
    results: [mockEservice1, mockEservice2, mockEservice3],
    totalCount: 3,
  };

  const apiEservices = delegationApi.CompactEServices.parse({
    results: mockEservices.results.map(eserviceToApiCompactEservice),
    totalCount: mockEservices.totalCount,
  });

  beforeEach(() => {
    delegationService.getConsumerEservices = vi
      .fn()
      .mockResolvedValue(apiEservices);
  });

  const makeRequest = async (
    token: string,
    query: typeof defaultQuery = defaultQuery
  ) =>
    request(api)
      .get("/consumer/eservices")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query(query);

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.API_ROLE,
    authRole.SECURITY_ROLE,
    authRole.M2M_ROLE,
    authRole.SUPPORT_ROLE,
  ];

  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiEservices);
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
    { query: { ...defaultQuery, offset: undefined } },
    { query: { ...defaultQuery, limit: undefined } },
    { query: { ...defaultQuery, delegatorId: undefined } },
    { query: { delegatorId: mockDelegator.id } },
    { query: { offset: -1, limit: 10 } },
    { query: { offset: 0, limit: -2 } },
    { query: { offset: 0, limit: 55 } },
    { query: { ...defaultQuery, offset: "invalid" } },
    { query: { ...defaultQuery, limit: "invalid" } },
    { query: { ...defaultQuery, delegatorId: "invalid" } },
  ])("Should return 400 if passed invalid data: %s", async ({ query }) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, query as typeof defaultQuery);
    expect(res.status).toBe(400);
  });
});
