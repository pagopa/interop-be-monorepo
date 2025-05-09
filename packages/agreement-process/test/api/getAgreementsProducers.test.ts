/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ListResult, generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { agreementApi } from "pagopa-interop-api-clients";
import { api, agreementService } from "../vitest.api.setup.js";

describe("API GET /producers test", () => {
  const mockProducer1 = { id: generateId(), name: "Producer 1" };
  const mockProducer2 = { id: generateId(), name: "Producer 2" };

  const producers: ListResult<agreementApi.CompactOrganization> = {
    results: [mockProducer1, mockProducer2],
    totalCount: 2,
  };

  const apiResponse = agreementApi.CompactOrganizations.parse({
    results: producers.results,
    totalCount: producers.totalCount,
  });

  beforeEach(() => {
    agreementService.getAgreementsProducers = vi
      .fn()
      .mockResolvedValue(producers);
  });

  const makeRequest = async (token: string, limit: unknown = 5) =>
    request(api)
      .get("/producers")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query({
        offset: 0,
        limit,
      });

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.API_ROLE,
    authRole.SECURITY_ROLE,
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

  it("Should return 400 if passed an invalid limit", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid");
    expect(res.status).toBe(400);
  });
});
