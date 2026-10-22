/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { purposeApi } from "pagopa-interop-api-clients";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import {
  DelegationId,
  DescriptorId,
  EServiceId,
  featureFlagNotEnabled,
  generateId,
} from "pagopa-interop-models";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  descriptorNotFound,
  eserviceNotFound,
  tenantIsNotTheDelegatedProducer,
  tenantIsNotTheProducer,
} from "../../src/model/domain/errors.js";
import { api, purposeService } from "../vitest.api.setup.js";

describe("API GET /producers/eservices/{eserviceId}/descriptors/{descriptorId}/monitoring/purposes test", () => {
  const eserviceId: EServiceId = generateId();
  const descriptorId: DescriptorId = generateId();

  const apiResponse: purposeApi.ProducerEServiceMonitoringPurposes = {
    approvedDailyCalls: 150,
    dailyCallsTotal: 1000,
    percentage: 15,
    waitingForApprovalNewPurposes: 2,
    waitingForApprovalQuotaChanges: 1,
  };

  beforeEach(() => {
    purposeService.getProducerEServiceMonitoringPurposes = vi
      .fn()
      .mockResolvedValue(apiResponse);
  });

  const makeRequest = async (
    token: string,
    params: { eserviceId?: string; descriptorId?: string } = {
      eserviceId,
      descriptorId,
    }
  ) =>
    request(api)
      .get(
        `/producers/eservices/${params.eserviceId}/descriptors/${params.descriptorId}/monitoring/purposes`
      )
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

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const res = await makeRequest(generateToken(role));
    expect(res.status).toBe(403);
  });

  it.each([
    { eserviceId: "invalid", descriptorId },
    { eserviceId, descriptorId: "invalid" },
  ])("Should return 400 if passed invalid data: %s", async (params) => {
    const res = await makeRequest(generateToken(authRole.ADMIN_ROLE), params);
    expect(res.status).toBe(400);
  });

  it.each([
    { error: eserviceNotFound(eserviceId), expectedStatus: 404 },
    {
      error: descriptorNotFound(eserviceId, descriptorId),
      expectedStatus: 404,
    },
    { error: tenantIsNotTheProducer(generateId()), expectedStatus: 403 },
    {
      error: tenantIsNotTheDelegatedProducer(
        generateId(),
        generateId<DelegationId>()
      ),
      expectedStatus: 403,
    },
    {
      error: featureFlagNotEnabled("featureFlagProducerDashboard"),
      expectedStatus: 501,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      purposeService.getProducerEServiceMonitoringPurposes = vi
        .fn()
        .mockRejectedValue(error);
      const res = await makeRequest(generateToken(authRole.ADMIN_ROLE));
      expect(res.status).toBe(expectedStatus);
    }
  );
});
