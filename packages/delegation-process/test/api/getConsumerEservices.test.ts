/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { delegationApi } from "pagopa-interop-api-clients";
import { generateToken, getMockEService } from "pagopa-interop-commons-test";
import { generateId } from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { delegationService } from "../integrationUtils.js";
import { api } from "../vitest.api.setup.js";

describe("API GET /consumer/eservices test", () => {
  const mockEservice1 = { ...getMockEService(), name: "Servizio 1" };
  const mockEservice2 = { ...getMockEService(), name: "Servizio 2" };
  const mockEservice3 = { ...getMockEService(), name: "Servizio 3" };

  const mockEservices = {
    results: [mockEservice1, mockEservice2, mockEservice3],
    totalCount: 3,
  };

  const apiEservices = delegationApi.Delegation.parse({
    results: delegationApi.CompactEServices.parse(mockEservices),
    totalCount: mockEservices.totalCount,
  });

  delegationService.getConsumerEservices = vi
    .fn()
    .mockResolvedValue(apiEservices);

  const makeRequest = async (token: string, limit: unknown = 10) =>
    request(api)
      .get("/consumer/eservices")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query({ offset: 0, limit });

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

  it("Should return 400 if passed an invalid parameter", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid");
    expect(res.status).toBe(400);
  });
});
