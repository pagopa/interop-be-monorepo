/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { bffApi } from "pagopa-interop-api-clients";
import { authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import { featureFlagNotEnabled, generateId } from "pagopa-interop-models";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { appBasePath } from "../../../src/config/appBasePath.js";
import { config } from "../../../src/config/config.js";
import { api, services } from "../../vitest.api.setup.js";

describe("API GET /producers/dashboard/consumers/{consumerId} test", () => {
  const consumerId = generateId();
  const mockConsumer: bffApi.ProducerDashboardConsumer = {
    consumer: { id: consumerId, name: "Comune di Roma", kind: "PA" },
    eservicesCount: 3,
    results: [
      {
        eservice: { id: generateId(), name: "Anagrafe" },
        descriptorId: generateId(),
        version: "2",
        agreement: { id: generateId(), state: "ACTIVE" },
        activePurposesCount: 2,
        approvedDailyCalls: 3000,
      },
    ],
    pagination: { offset: 0, limit: 10, totalCount: 1 },
  };

  beforeEach(() => {
    config.featureFlagProducerDashboard = true;
    services.producerDashboardService.getProducerDashboardConsumer = vi
      .fn()
      .mockResolvedValue(mockConsumer);
  });

  afterEach(() => {
    config.featureFlagProducerDashboard = false;
  });

  const makeRequest = async (
    token: string,
    query: Record<string, unknown> = { offset: 0, limit: 10 },
    id: string = consumerId
  ) =>
    request(api)
      .get(`${appBasePath}/producers/dashboard/consumers/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query(query)
      .send();

  it("Should return 200 for user with role Admin", async () => {
    const res = await makeRequest(generateToken(authRole.ADMIN_ROLE), {
      offset: 0,
      limit: 5,
      q: "ana",
      sortBy: "DAILY_CALLS_DESC",
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockConsumer);
    expect(
      services.producerDashboardService.getProducerDashboardConsumer
    ).toHaveBeenCalledWith(
      consumerId,
      { offset: 0, limit: 5, q: "ana", sortBy: "DAILY_CALLS_DESC" },
      expect.anything()
    );
  });

  it("Should return 501 if the feature flag is not enabled", async () => {
    services.producerDashboardService.getProducerDashboardConsumer = vi
      .fn()
      .mockRejectedValue(featureFlagNotEnabled("featureFlagProducerDashboard"));
    const res = await makeRequest(generateToken(authRole.ADMIN_ROLE));
    expect(res.status).toBe(501);
  });

  it.each([
    { query: { offset: 0, limit: 10 }, id: "invalid" },
    { query: {} },
    { query: { offset: 0 } },
    { query: { limit: 10 } },
    { query: { offset: -1, limit: 10 } },
    { query: { offset: 0, limit: 0 } },
    { query: { offset: 0, limit: 51 } },
    { query: { offset: 0, limit: 10, sortBy: "invalid" } },
  ])("Should return 400 if passed invalid data: %s", async ({ query, id }) => {
    const res = await makeRequest(
      generateToken(authRole.ADMIN_ROLE),
      query,
      id
    );
    expect(res.status).toBe(400);
  });
});
