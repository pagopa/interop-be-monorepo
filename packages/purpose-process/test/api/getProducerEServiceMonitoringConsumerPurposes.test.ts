/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { purposeApi } from "pagopa-interop-api-clients";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import {
  DescriptorId,
  EServiceId,
  featureFlagNotEnabled,
  generateId,
  purposeVersionState,
  TenantId,
} from "pagopa-interop-models";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  descriptorNotFound,
  eserviceNotFound,
  tenantIsNotTheProducer,
  tenantNotFound,
} from "../../src/model/domain/errors.js";
import { api, purposeService } from "../vitest.api.setup.js";

describe("API GET /producers/eservices/{eserviceId}/descriptors/{descriptorId}/monitoring/consumers/{consumerId}/purposes", () => {
  const eserviceId: EServiceId = generateId<EServiceId>();
  const descriptorId: DescriptorId = generateId<DescriptorId>();
  const consumerId: TenantId = generateId<TenantId>();
  const apiResponse: purposeApi.ProducerEServiceMonitoringConsumerPurposes = {
    eservice: { id: eserviceId, name: "Anagrafe" },
    version: "3",
    consumer: { id: consumerId, name: "Comune di Roma", kind: "PA" },
    dailyCallsPerConsumer: 1000,
    customizedByAttribute: {
      id: generateId(),
      name: "Comuni",
      kind: "CERTIFIED",
    },
    approvedDailyCalls: 500,
    percentage: 50,
    waitingForApprovalPurposes: 1,
    results: [
      {
        purposeId: generateId(),
        title: "Finalità",
        dailyCalls: 500,
        state: "ACTIVE",
        suspendedByConsumer: false,
        suspendedByProducer: false,
        updatedAt: new Date().toISOString(),
        hasPendingQuotaChange: false,
      },
    ],
    pagination: { offset: 0, limit: 10, totalCount: 1 },
  };

  beforeEach(() => {
    purposeService.getProducerEServiceMonitoringConsumerPurposes = vi
      .fn()
      .mockResolvedValue(apiResponse);
  });

  const makeRequest = async (
    token: string,
    query: Record<string, unknown> = { offset: 0, limit: 10 },
    params: { eserviceId: string; descriptorId: string; consumerId: string } = {
      eserviceId,
      descriptorId,
      consumerId,
    }
  ) =>
    request(api)
      .get(
        `/producers/eservices/${params.eserviceId}/descriptors/${params.descriptorId}/monitoring/consumers/${params.consumerId}/purposes`
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
    "returns 200 for user with role %s and defaults sorting and filters",
    async (role) => {
      const res = await makeRequest(generateToken(role), {
        offset: 5,
        limit: 5,
        q: "Finalità",
      });

      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiResponse);
      expect(
        purposeService.getProducerEServiceMonitoringConsumerPurposes
      ).toHaveBeenCalledWith(
        eserviceId,
        descriptorId,
        consumerId,
        {
          q: "Finalità",
          sortBy: "DATE_DESC",
          states: [],
          includeArchived: false,
          offset: 5,
          limit: 5,
        },
        expect.anything()
      );
    }
  );

  it("converts states and passes sortBy and includeArchived", async () => {
    const res = await makeRequest(generateToken(authRole.ADMIN_ROLE), {
      offset: 0,
      limit: 10,
      sortBy: "NAME_ASC",
      states: "ACTIVE,WAITING_FOR_APPROVAL",
      includeArchived: true,
    });

    expect(res.status).toBe(200);
    expect(
      purposeService.getProducerEServiceMonitoringConsumerPurposes
    ).toHaveBeenCalledWith(
      eserviceId,
      descriptorId,
      consumerId,
      {
        q: undefined,
        sortBy: "NAME_ASC",
        states: [
          purposeVersionState.active,
          purposeVersionState.waitingForApproval,
        ],
        includeArchived: true,
        offset: 0,
        limit: 10,
      },
      expect.anything()
    );
  });

  it("returns 200 for a consumer without relationship (no consumer, empty results)", async () => {
    const emptyResponse: purposeApi.ProducerEServiceMonitoringConsumerPurposes =
      {
        eservice: apiResponse.eservice,
        version: apiResponse.version,
        dailyCallsPerConsumer: 1000,
        approvedDailyCalls: 0,
        percentage: 0,
        waitingForApprovalPurposes: 0,
        results: [],
        pagination: { offset: 0, limit: 10, totalCount: 0 },
      };
    purposeService.getProducerEServiceMonitoringConsumerPurposes = vi
      .fn()
      .mockResolvedValue(emptyResponse);

    const res = await makeRequest(generateToken(authRole.ADMIN_ROLE));

    expect(res.status).toBe(200);
    expect(res.body).toEqual(emptyResponse);
  });

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
    { offset: 0, limit: 10, sortBy: "PERCENTAGE_DESC" },
    { offset: 0, limit: 10, states: "INVALID" },
    { offset: 0, limit: 10, includeArchived: "INVALID" },
  ])("returns 400 for invalid query: %s", async (query) => {
    const res = await makeRequest(generateToken(authRole.ADMIN_ROLE), query);
    expect(res.status).toBe(400);
  });

  it.each([
    { eserviceId: "invalid", descriptorId, consumerId },
    { eserviceId, descriptorId: "invalid", consumerId },
    { eserviceId, descriptorId, consumerId: "invalid" },
  ])("returns 400 for invalid path params: %s", async (params) => {
    const res = await makeRequest(
      generateToken(authRole.ADMIN_ROLE),
      { offset: 0, limit: 10 },
      params
    );
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
    { error: tenantNotFound(consumerId), expectedStatus: 500 },
  ])(
    "returns $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      purposeService.getProducerEServiceMonitoringConsumerPurposes = vi
        .fn()
        .mockRejectedValue(error);
      const res = await makeRequest(generateToken(authRole.ADMIN_ROLE));
      expect(res.status).toBe(expectedStatus);
    }
  );
});
