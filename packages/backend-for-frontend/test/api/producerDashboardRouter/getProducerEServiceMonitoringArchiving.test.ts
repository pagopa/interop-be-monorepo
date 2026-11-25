/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { bffApi } from "pagopa-interop-api-clients";
import { authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import {
  EServiceId,
  featureFlagNotEnabled,
  generateId,
} from "pagopa-interop-models";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { appBasePath } from "../../../src/config/appBasePath.js";
import { api, services } from "../../vitest.api.setup.js";

describe("API GET /producers/eservices/{eserviceId}/monitoring/archiving test", () => {
  const eserviceId = generateId<EServiceId>();
  const mockArchiving: bffApi.MonitoringArchiving = {
    results: [
      {
        eservice: { id: eserviceId, name: "Anagrafe" },
        descriptorId: generateId(),
        version: "2",
        consumersCount: 4,
        archivableOn: new Date().toJSON(),
      },
    ],
    pagination: { offset: 0, limit: 10, totalCount: 1 },
  };

  beforeEach(() => {
    services.producerDashboardService.getProducerEServiceMonitoringArchiving =
      vi.fn().mockResolvedValue(mockArchiving);
  });

  const makeRequest = async (
    token: string,
    id: string = eserviceId,
    query: Record<string, unknown> = { offset: 0, limit: 10 }
  ) =>
    request(api)
      .get(`${appBasePath}/producers/eservices/${id}/monitoring/archiving`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query(query)
      .send();

  it("Should return 200 for user with role Admin", async () => {
    const res = await makeRequest(generateToken(authRole.ADMIN_ROLE));
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockArchiving);
    expect(
      services.producerDashboardService.getProducerEServiceMonitoringArchiving
    ).toHaveBeenCalledWith(
      eserviceId,
      { offset: 0, limit: 10 },
      expect.anything()
    );
  });

  it("Should return 501 if the feature flag is not enabled", async () => {
    services.producerDashboardService.getProducerEServiceMonitoringArchiving =
      vi
        .fn()
        .mockRejectedValue(
          featureFlagNotEnabled("featureFlagProducerDashboard")
        );
    const res = await makeRequest(generateToken(authRole.ADMIN_ROLE));
    expect(res.status).toBe(501);
  });

  it.each([
    [{ offset: 0, limit: 10 }, "invalid"],
    [{}, eserviceId],
    [{ offset: 0 }, eserviceId],
    [{ limit: 10 }, eserviceId],
    [{ offset: -1, limit: 10 }, eserviceId],
    [{ offset: 0, limit: 0 }, eserviceId],
    [{ offset: 0, limit: 51 }, eserviceId],
  ])(
    "Should return 400 if passed invalid params: %s (eserviceId: %s)",
    async (query, id) => {
      const res = await makeRequest(
        generateToken(authRole.ADMIN_ROLE),
        id,
        query
      );
      expect(res.status).toBe(400);
    }
  );
});
