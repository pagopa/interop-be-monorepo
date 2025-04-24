/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ListResult, Purpose, generateId } from "pagopa-interop-models";
import { generateToken, getMockPurpose } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { purposeApi } from "pagopa-interop-api-clients";
import { api, purposeService } from "../vitest.api.setup.js";
import { purposeToApiPurpose } from "../../src/model/domain/apiConverter.js";

describe("API GET /purposes/{purposeId} test", () => {
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

  const makeRequest = async (token: string, limit: unknown = 5) =>
    request(api)
      .get("/purposes")
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
    authRole.M2M_ROLE,
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
