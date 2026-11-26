/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { bffApi } from "pagopa-interop-api-clients";
import { authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import { featureFlagNotEnabled, generateId } from "pagopa-interop-models";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { appBasePath } from "../../../src/config/appBasePath.js";
import { api, services } from "../../vitest.api.setup.js";

describe("API GET /producers/eservices/{eserviceId}/descriptors/{descriptorId}/monitoring/consumers/{consumerId}/purposes", () => {
  const eserviceId = generateId();
  const descriptorId = generateId();
  const consumerId = generateId();
  const consumerPurposes: bffApi.ProducerEServiceMonitoringConsumerPurposes = {
    eservice: { id: eserviceId, name: "Anagrafe" },
    version: "3",
    consumer: { id: consumerId, name: "Comune di Roma", kind: "PA" },
    dailyCallsPerConsumer: 2000,
    customizedByAttribute: {
      id: generateId(),
      name: "Comuni",
      kind: "CERTIFIED",
    },
    approvedDailyCalls: 600,
    percentage: 30,
    waitingForApprovalPurposes: 1,
    results: [
      {
        purposeId: generateId(),
        title: "Finalità",
        dailyCalls: 600,
        state: "ACTIVE",
        suspendedByConsumer: false,
        suspendedByProducer: false,
        updatedAt: new Date().toISOString(),
        hasPendingQuotaChange: false,
      },
    ],
    pagination: { offset: 0, limit: 5, totalCount: 1 },
  };

  beforeEach(() => {
    services.producerDashboardService.getProducerEServiceMonitoringConsumerPurposes =
      vi.fn().mockResolvedValue(consumerPurposes);
  });

  const makeRequest = (
    query: Record<string, unknown> = { offset: 0, limit: 10 }
  ) =>
    request(api)
      .get(
        `${appBasePath}/producers/eservices/${eserviceId}/descriptors/${descriptorId}/monitoring/consumers/${consumerId}/purposes`
      )
      .set("Authorization", `Bearer ${generateToken(authRole.ADMIN_ROLE)}`)
      .set("X-Correlation-Id", generateId())
      .query(query);

  it("passes the path parameters and the query to the service", async () => {
    const res = await makeRequest({
      offset: 0,
      limit: 5,
      q: "Finalità",
      sortBy: "NAME_ASC",
      states: "ACTIVE,WAITING_FOR_APPROVAL",
      includeArchived: true,
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(consumerPurposes);
    expect(
      services.producerDashboardService
        .getProducerEServiceMonitoringConsumerPurposes
    ).toHaveBeenCalledWith(
      eserviceId,
      descriptorId,
      consumerId,
      {
        offset: 0,
        limit: 5,
        q: "Finalità",
        sortBy: "NAME_ASC",
        states: ["ACTIVE", "WAITING_FOR_APPROVAL"],
        includeArchived: true,
      },
      expect.anything()
    );
  });

  it("returns 200 without consumer for a consumer without relationship", async () => {
    const emptyResponse: bffApi.ProducerEServiceMonitoringConsumerPurposes = {
      eservice: consumerPurposes.eservice,
      version: consumerPurposes.version,
      dailyCallsPerConsumer: 1000,
      approvedDailyCalls: 0,
      percentage: 0,
      waitingForApprovalPurposes: 0,
      results: [],
      pagination: { offset: 0, limit: 10, totalCount: 0 },
    };
    services.producerDashboardService.getProducerEServiceMonitoringConsumerPurposes =
      vi.fn().mockResolvedValue(emptyResponse);

    const res = await makeRequest();

    expect(res.status).toBe(200);
    expect(res.body).toEqual(emptyResponse);
  });

  it("returns 501 when the feature flag is not enabled", async () => {
    services.producerDashboardService.getProducerEServiceMonitoringConsumerPurposes =
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
    { offset: 0, limit: 10, states: "invalid" },
    { offset: 0, limit: 10, includeArchived: "invalid" },
  ])("returns 400 for invalid query: %s", async (query) => {
    const res = await makeRequest(query);
    expect(res.status).toBe(400);
  });
});
