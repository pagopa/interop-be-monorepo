/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { bffApi, catalogApi } from "pagopa-interop-api-clients";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import { generateId } from "pagopa-interop-models";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { appBasePath } from "../../../src/config/appBasePath.js";
import { config } from "../../../src/config/config.js";
import { api, clients } from "../../vitest.api.setup.js";

describe("API GET /producers/dashboard", () => {
  const originalFlag = config.featureFlagProducerDashboard;
  const dashboard: catalogApi.ProducerDashboardEServices = {
    eservices: {
      total: 4,
      published: 1,
      suspended: 1,
      archiving: 1,
      archivingSuspended: 1,
    },
    pendingAgreements: 2,
    waitingForApprovalPurposes: 3,
    activeAgreements: 4,
    alignment: {
      aligned: 3,
      agreementWithoutPurposes: 1,
      purposesWithoutAgreement: 2,
    },
    averageActivePurposesPerEService: 1.5,
  };
  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.SUPPORT_ROLE,
    authRole.API_ROLE,
    authRole.SECURITY_ROLE,
    authRole.VIEWER_ROLE,
  ];
  const correlationId = generateId();
  const forwardedFor = "127.0.0.1";
  const makeRequest = (token: string) =>
    request(api)
      .get(`${appBasePath}/producers/dashboard`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", correlationId)
      .set("X-Forwarded-For", forwardedFor);

  beforeEach(() => {
    config.featureFlagProducerDashboard = true;
    clients.catalogProcessClient.getProducerDashboardEServices = vi
      .fn()
      .mockResolvedValue(dashboard);
  });

  afterEach(() => {
    config.featureFlagProducerDashboard = originalFlag;
  });

  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(bffApi.ProducerDashboard.parse(dashboard));
      expect(
        clients.catalogProcessClient.getProducerDashboardEServices
      ).toHaveBeenCalledExactlyOnceWith({
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Correlation-Id": res.headers["x-correlation-id"],
          "X-Forwarded-For": forwardedFor,
        },
      });
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const res = await makeRequest(generateToken(role));
    expect(res.status).toBe(403);
    expect(
      clients.catalogProcessClient.getProducerDashboardEServices
    ).not.toHaveBeenCalled();
  });

  it("Should return 501 when feature flag is disabled", async () => {
    config.featureFlagProducerDashboard = false;
    const res = await makeRequest(generateToken(authRole.ADMIN_ROLE));
    expect(res.status).toBe(501);
    expect(
      clients.catalogProcessClient.getProducerDashboardEServices
    ).not.toHaveBeenCalled();
  });

  it("Should return zero counters for an empty dashboard", async () => {
    const emptyDashboard: catalogApi.ProducerDashboardEServices = {
      eservices: {
        total: 0,
        published: 0,
        suspended: 0,
        archiving: 0,
        archivingSuspended: 0,
      },
      pendingAgreements: 0,
      waitingForApprovalPurposes: 0,
      activeAgreements: 0,
      alignment: {
        aligned: 0,
        agreementWithoutPurposes: 0,
        purposesWithoutAgreement: 0,
      },
      averageActivePurposesPerEService: 0,
    };
    vi.mocked(
      clients.catalogProcessClient.getProducerDashboardEServices
    ).mockResolvedValue(emptyDashboard);
    const res = await makeRequest(generateToken(authRole.ADMIN_ROLE));
    expect(res.status).toBe(200);
    expect(res.body).toEqual(emptyDashboard);
  });

  it("Should return 500 for an unexpected catalog error", async () => {
    vi.mocked(
      clients.catalogProcessClient.getProducerDashboardEServices
    ).mockRejectedValue(new Error("Unexpected catalog error"));
    const res = await makeRequest(generateToken(authRole.ADMIN_ROLE));
    expect(res.status).toBe(500);
  });
});
