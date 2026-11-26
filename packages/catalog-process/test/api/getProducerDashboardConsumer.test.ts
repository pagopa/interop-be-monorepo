/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { catalogApi } from "pagopa-interop-api-clients";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import {
  AgreementId,
  agreementState,
  DescriptorId,
  EServiceId,
  generateId,
  TenantId,
  tenantKind,
} from "pagopa-interop-models";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProducerDashboardConsumerResult } from "../../src/model/domain/models.js";
import { api, catalogService } from "../vitest.api.setup.js";

describe("GET /producers/dashboard/consumers/{consumerId}", () => {
  const consumerId = generateId<TenantId>();
  const serviceResult: ProducerDashboardConsumerResult = {
    consumer: { id: consumerId, name: "Comune di Roma", kind: tenantKind.PA },
    eservicesCount: 3,
    totalCount: 1,
    results: [
      {
        eserviceId: generateId<EServiceId>(),
        eserviceName: "Anagrafe",
        descriptorId: generateId<DescriptorId>(),
        version: "2",
        agreementId: generateId<AgreementId>(),
        agreementState: agreementState.suspended,
        activePurposesCount: 2,
        approvedDailyCalls: 3000,
      },
    ],
  };
  const [row] = serviceResult.results;
  const expectedBody: catalogApi.ProducerDashboardConsumer = {
    consumer: { id: consumerId, name: "Comune di Roma", kind: "PA" },
    eservicesCount: 3,
    results: [
      {
        eservice: { id: row.eserviceId, name: row.eserviceName },
        descriptorId: row.descriptorId,
        version: "2",
        agreement: { id: row.agreementId, state: "SUSPENDED" },
        activePurposesCount: 2,
        approvedDailyCalls: 3000,
      },
    ],
    pagination: { offset: 0, limit: 10, totalCount: 1 },
  };
  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.SUPPORT_ROLE,
    authRole.API_ROLE,
    authRole.VIEWER_ROLE,
  ];
  const makeRequest = (
    token: string,
    query: Record<string, unknown> = { offset: 0, limit: 10 },
    id: string = consumerId
  ) =>
    request(api)
      .get(`/producers/dashboard/consumers/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query(query);

  beforeEach(() => {
    catalogService.getProducerDashboardConsumer = vi
      .fn()
      .mockResolvedValue(serviceResult);
  });

  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const res = await makeRequest(generateToken(role));
      expect(res.status).toBe(200);
      expect(res.body).toEqual(expectedBody);
    }
  );

  it("Should pass the parameters to the service", async () => {
    const res = await makeRequest(generateToken(authRole.ADMIN_ROLE), {
      offset: 5,
      limit: 5,
      q: "ana",
      sortBy: "DAILY_CALLS_DESC",
    });
    expect(res.status).toBe(200);
    expect(res.body.pagination).toEqual({
      offset: 5,
      limit: 5,
      totalCount: 1,
    });
    expect(catalogService.getProducerDashboardConsumer).toHaveBeenCalledWith(
      consumerId,
      { offset: 5, limit: 5, q: "ana", sortBy: "DAILY_CALLS_DESC" },
      expect.anything()
    );
  });

  it("Should return an empty body without consumer for an unrelated consumer", async () => {
    catalogService.getProducerDashboardConsumer = vi.fn().mockResolvedValue({
      consumer: undefined,
      eservicesCount: 0,
      totalCount: 0,
      results: [],
    });
    const res = await makeRequest(generateToken(authRole.ADMIN_ROLE));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      eservicesCount: 0,
      results: [],
      pagination: { offset: 0, limit: 10, totalCount: 0 },
    });
  });

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const res = await makeRequest(generateToken(role));
    expect(res.status).toBe(403);
    expect(catalogService.getProducerDashboardConsumer).not.toHaveBeenCalled();
  });

  it.each([
    { query: { offset: 0, limit: 10 }, id: "invalid" },
    { query: {} },
    { query: { offset: 0 } },
    { query: { limit: 10 } },
    { query: { offset: -1, limit: 10 } },
    { query: { offset: "a", limit: 10 } },
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
    expect(catalogService.getProducerDashboardConsumer).not.toHaveBeenCalled();
  });

  it("Should return 500 for unexpected errors", async () => {
    vi.mocked(catalogService.getProducerDashboardConsumer).mockRejectedValue(
      new Error("Unexpected error")
    );
    const res = await makeRequest(generateToken(authRole.ADMIN_ROLE));
    expect(res.status).toBe(500);
  });
});
