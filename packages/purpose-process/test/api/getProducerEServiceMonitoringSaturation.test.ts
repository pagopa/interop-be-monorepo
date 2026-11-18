/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { purposeApi } from "pagopa-interop-api-clients";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import {
  DescriptorId,
  EServiceId,
  featureFlagNotEnabled,
  generateId,
} from "pagopa-interop-models";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  descriptorNotFound,
  eserviceNotFound,
  tenantIsNotTheProducer,
} from "../../src/model/domain/errors.js";
import { api, purposeService } from "../vitest.api.setup.js";

describe("API GET /producers/eservices/{eserviceId}/descriptors/{descriptorId}/monitoring/saturation", () => {
  const eserviceId: EServiceId = generateId<EServiceId>();
  const descriptorId: DescriptorId = generateId<DescriptorId>();
  const apiResponse: purposeApi.ProducerEServiceMonitoringSaturation = {
    eservice: { id: eserviceId, name: "Anagrafe" },
    version: "3",
    otherVersions: [],
    dailyCallsPerConsumer: 1000,
    dailyCallsTotal: 10000,
    customizedQuotaConsumers: 0,
    activeConsumers: 0,
    results: [],
    pagination: { offset: 0, limit: 10, totalCount: 0 },
  };

  beforeEach(() => {
    purposeService.getProducerEServiceMonitoringSaturation = vi
      .fn()
      .mockResolvedValue(apiResponse);
  });

  const makeRequest = async (
    token: string,
    query: Record<string, unknown> = { offset: 0, limit: 10 },
    params: { eserviceId: string; descriptorId: string } = {
      eserviceId,
      descriptorId,
    }
  ) =>
    request(api)
      .get(
        `/producers/eservices/${params.eserviceId}/descriptors/${params.descriptorId}/monitoring/saturation`
      )
      .query(query)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.SUPPORT_ROLE,
    authRole.API_ROLE,
    authRole.VIEWER_ROLE,
  ];

  it.each(authorizedRoles)(
    "returns 200 for user with role %s and defaults sorting",
    async (role) => {
      const res = await makeRequest(generateToken(role), {
        offset: 5,
        limit: 5,
        q: "Comune",
      });

      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiResponse);
      expect(
        purposeService.getProducerEServiceMonitoringSaturation
      ).toHaveBeenCalledWith(
        eserviceId,
        descriptorId,
        {
          q: "Comune",
          sortBy: "PERCENTAGE_DESC",
          offset: 5,
          limit: 5,
        },
        expect.anything()
      );
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("returns 403 for user with role %s", async (role) => {
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
  ])("returns 400 for invalid query: %s", async (query) => {
    const res = await makeRequest(generateToken(authRole.ADMIN_ROLE), query);
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
      error: featureFlagNotEnabled("featureFlagProducerDashboard"),
      expectedStatus: 501,
    },
  ])(
    "returns $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      purposeService.getProducerEServiceMonitoringSaturation = vi
        .fn()
        .mockRejectedValue(error);
      const res = await makeRequest(generateToken(authRole.ADMIN_ROLE));
      expect(res.status).toBe(expectedStatus);
    }
  );
});
