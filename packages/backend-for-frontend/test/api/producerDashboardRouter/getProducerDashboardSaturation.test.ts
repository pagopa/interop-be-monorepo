/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { bffApi } from "pagopa-interop-api-clients";
import { authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import { featureFlagNotEnabled, generateId } from "pagopa-interop-models";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { appBasePath } from "../../../src/config/appBasePath.js";
import { api, services } from "../../vitest.api.setup.js";

describe("API GET /producers/dashboard/saturation test", () => {
  const mockSaturation: bffApi.ProducerDashboardSaturation = {
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
    services.producerDashboardService.getProducerDashboardSaturation = vi
      .fn()
      .mockResolvedValue(mockSaturation);
  });

  const makeRequest = async (
    token: string,
    query: Record<string, unknown> = { offset: 0, limit: 10 }
  ) =>
    request(api)
      .get(`${appBasePath}/producers/dashboard/saturation`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query(query)
      .send();

  it("Should return 200 for user with role Admin", async () => {
    const res = await makeRequest(generateToken(authRole.ADMIN_ROLE), {
      offset: 0,
      limit: 5,
      q: "ana",
      sortBy: "NAME_ASC",
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockSaturation);
    expect(
      services.producerDashboardService.getProducerDashboardSaturation
    ).toHaveBeenCalledWith(
      { offset: 0, limit: 5, q: "ana", sortBy: "NAME_ASC" },
      expect.anything()
    );
  });

  it("Should return 501 if the feature flag is not enabled", async () => {
    services.producerDashboardService.getProducerDashboardSaturation = vi
      .fn()
      .mockRejectedValue(featureFlagNotEnabled("featureFlagProducerDashboard"));
    const res = await makeRequest(generateToken(authRole.ADMIN_ROLE));
    expect(res.status).toBe(501);
  });

  it.each([
    {},
    { offset: 0 },
    { limit: 10 },
    { offset: -1, limit: 10 },
    { offset: 0, limit: 0 },
    { offset: 0, limit: 51 },
    { offset: 0, limit: 10, sortBy: "invalid" },
  ])("Should return 400 if passed invalid data: %s", async (query) => {
    const res = await makeRequest(generateToken(authRole.ADMIN_ROLE), query);
    expect(res.status).toBe(400);
  });
});
