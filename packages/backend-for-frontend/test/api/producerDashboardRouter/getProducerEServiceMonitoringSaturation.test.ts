/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { bffApi } from "pagopa-interop-api-clients";
import { authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import { featureFlagNotEnabled, generateId } from "pagopa-interop-models";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { appBasePath } from "../../../src/config/appBasePath.js";
import { api, services } from "../../vitest.api.setup.js";

describe("API GET /producers/eservices/{eserviceId}/descriptors/{descriptorId}/monitoring/saturation", () => {
  const eserviceId = generateId();
  const descriptorId = generateId();
  const saturation: bffApi.ProducerEServiceMonitoringSaturation = {
    eservice: { id: eserviceId, name: "Anagrafe" },
    version: "3",
    otherVersions: [],
    dailyCallsPerConsumer: 1000,
    dailyCallsTotal: 10000,
    customizedQuotaConsumers: 0,
    activeConsumers: 1,
    results: [
      {
        consumer: { id: generateId(), name: "Comune di Roma", kind: "PA" },
        activePurposesCount: 1,
        approvedDailyCalls: 900,
        dailyCallsPerConsumer: 1000,
        percentage: 90,
        waitingForApprovalDailyCalls: 0,
      },
    ],
    pagination: { offset: 0, limit: 5, totalCount: 1 },
  };

  beforeEach(() => {
    services.producerDashboardService.getProducerEServiceMonitoringSaturation =
      vi.fn().mockResolvedValue(saturation);
  });

  const makeRequest = (
    query: Record<string, unknown> = { offset: 0, limit: 10 }
  ) =>
    request(api)
      .get(
        `${appBasePath}/producers/eservices/${eserviceId}/descriptors/${descriptorId}/monitoring/saturation`
      )
      .set("Authorization", `Bearer ${generateToken(authRole.ADMIN_ROLE)}`)
      .set("X-Correlation-Id", generateId())
      .query(query);

  it("passes the selected descriptor and pagination query to the service", async () => {
    const res = await makeRequest({
      offset: 0,
      limit: 5,
      sortBy: "PERCENTAGE_DESC",
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(saturation);
    expect(
      services.producerDashboardService.getProducerEServiceMonitoringSaturation
    ).toHaveBeenCalledWith(
      eserviceId,
      descriptorId,
      { offset: 0, limit: 5, sortBy: "PERCENTAGE_DESC" },
      expect.anything()
    );
  });

  it("returns 501 when the feature flag is not enabled", async () => {
    services.producerDashboardService.getProducerEServiceMonitoringSaturation =
      vi
        .fn()
        .mockRejectedValue(
          featureFlagNotEnabled("featureFlagProducerDashboard")
        );
    const res = await makeRequest();
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
  ])("returns 400 for invalid query: %s", async (query) => {
    const res = await makeRequest(query);
    expect(res.status).toBe(400);
  });
});
