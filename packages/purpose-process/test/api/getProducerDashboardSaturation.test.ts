/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { purposeApi } from "pagopa-interop-api-clients";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import { featureFlagNotEnabled, generateId } from "pagopa-interop-models";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { api, purposeService } from "../vitest.api.setup.js";

describe("API GET /producers/dashboard/saturation test", () => {
  const apiResponse: purposeApi.ProducerDashboardSaturation = {
    summary: { overThreshold: 1, nearThreshold: 0, total: 1 },
    results: [
      {
        eservice: { id: generateId(), name: "Anagrafe" },
        descriptorId: generateId(),
        version: "3",
        activePurposesCount: 12,
        approvedDailyCalls: 10500,
        dailyCallsTotal: 10000,
        percentage: 105,
        waitingForApprovalDailyCalls: 2000,
      },
    ],
    pagination: { offset: 0, limit: 10, totalCount: 1 },
  };

  beforeEach(() => {
    purposeService.getProducerDashboardSaturation = vi
      .fn()
      .mockResolvedValue(apiResponse);
  });

  const makeRequest = async (
    token: string,
    query: Record<string, unknown> = { offset: 0, limit: 10 }
  ) =>
    request(api)
      .get("/producers/dashboard/saturation")
      .query(query)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  const authorizedRoles: AuthRole[] = [authRole.ADMIN_ROLE];

  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const res = await makeRequest(generateToken(role));
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiResponse);
    }
  );

  it("Should pass the query parameters to the service, defaulting the sorting", async () => {
    await makeRequest(generateToken(authRole.ADMIN_ROLE), {
      offset: 5,
      limit: 5,
      q: "ana",
    });
    expect(purposeService.getProducerDashboardSaturation).toHaveBeenCalledWith(
      { offset: 5, limit: 5, q: "ana", sortBy: "PERCENTAGE_DESC" },
      expect.anything()
    );
  });

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const res = await makeRequest(generateToken(role));
    expect(res.status).toBe(403);
  });

  it.each([
    {},
    { offset: 0 },
    { limit: 10 },
    { offset: -1, limit: 10 },
    { offset: 0, limit: 0 },
    { offset: 0, limit: 51 },
    { offset: 0, limit: 10, sortBy: "INVALID" },
  ])("Should return 400 if passed invalid data: %s", async (query) => {
    const res = await makeRequest(generateToken(authRole.ADMIN_ROLE), query);
    expect(res.status).toBe(400);
  });

  it("Should return 501 when the feature flag is not enabled", async () => {
    purposeService.getProducerDashboardSaturation = vi
      .fn()
      .mockRejectedValue(featureFlagNotEnabled("featureFlagProducerDashboard"));
    const res = await makeRequest(generateToken(authRole.ADMIN_ROLE));
    expect(res.status).toBe(501);
  });
});
