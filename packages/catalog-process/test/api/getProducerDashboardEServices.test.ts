/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { catalogApi } from "pagopa-interop-api-clients";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import { generateId } from "pagopa-interop-models";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { api, catalogService } from "../vitest.api.setup.js";

describe("GET /producers/dashboard/eservices", () => {
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
  const makeRequest = (token: string) =>
    request(api)
      .get("/producers/dashboard/eservices")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  beforeEach(() => {
    catalogService.getProducerDashboardEServices = vi
      .fn()
      .mockResolvedValue(dashboard);
  });

  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const res = await makeRequest(generateToken(role));
      expect(res.status).toBe(200);
      expect(res.body).toEqual(dashboard);
      expect(
        catalogService.getProducerDashboardEServices
      ).toHaveBeenCalledOnce();
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const res = await makeRequest(generateToken(role));
    expect(res.status).toBe(403);
    expect(catalogService.getProducerDashboardEServices).not.toHaveBeenCalled();
  });

  it("Should return 500 for unexpected errors", async () => {
    vi.mocked(catalogService.getProducerDashboardEServices).mockRejectedValue(
      new Error("Unexpected error")
    );
    const res = await makeRequest(generateToken(authRole.ADMIN_ROLE));
    expect(res.status).toBe(500);
  });
});
