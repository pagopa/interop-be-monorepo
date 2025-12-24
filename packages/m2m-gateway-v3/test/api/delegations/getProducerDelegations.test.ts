import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiDelegation,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { delegationApi, m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { generateId } from "pagopa-interop-models";
import { api, mockDelegationService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { unexpectedDelegationKind } from "../../../src/model/errors.js";
import { toM2MGatewayApiProducerDelegation } from "../../../src/api/delegationApiConverter.js";

describe("GET /producerDelegations router test", () => {
  const mockApiDelegation1 = getMockedApiDelegation({
    kind: delegationApi.DelegationKind.Values.DELEGATED_PRODUCER,
  });
  const mockApiDelegation2 = getMockedApiDelegation({
    kind: delegationApi.DelegationKind.Values.DELEGATED_PRODUCER,
  });

  const mockM2MDelegationsResponse: m2mGatewayApiV3.ProducerDelegations = {
    pagination: { offset: 0, limit: 10, totalCount: 2 },
    results: [
      toM2MGatewayApiProducerDelegation(mockApiDelegation1),
      toM2MGatewayApiProducerDelegation(mockApiDelegation2),
    ],
  };

  const mockQueryParams: m2mGatewayApiV3.GetProducerDelegationsQueryParams = {
    states: ["WAITING_FOR_APPROVAL"],
    eserviceIds: [generateId()],
    delegateIds: [generateId()],
    delegatorIds: [generateId()],
    offset: 0,
    limit: 10,
  };

  const makeRequest = async (
    token: string,
    query: m2mGatewayApiV3.GetProducerDelegationsQueryParams
  ) =>
    request(api)
      .get(`${appBasePath}/producerDelegations`)
      .set("Authorization", `Bearer ${token}`)
      .query(query)
      .send();

  const authorizedRoles: AuthRole[] = [
    authRole.M2M_ADMIN_ROLE,
    authRole.M2M_ROLE,
  ];
  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockDelegationService.getProducerDelegations = vi
        .fn()
        .mockResolvedValue(mockM2MDelegationsResponse);

      const token = generateToken(role);
      const res = await makeRequest(token, mockQueryParams);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MDelegationsResponse);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockQueryParams);
    expect(res.status).toBe(403);
  });
  it.each([
    {},
    { ...mockQueryParams, states: ["invalidState"] },
    { ...mockQueryParams, offset: -2 },
    { ...mockQueryParams, limit: 100 },
    { ...mockQueryParams, offset: "invalidOffset" },
    { ...mockQueryParams, limit: "invalidLimit" },
    { ...mockQueryParams, eserviceIds: ["invalidId"] },
    { ...mockQueryParams, delegateIds: ["invalidId"] },
    { ...mockQueryParams, delegatorIds: ["invalidId"] },
  ])("Should return 400 if passed invalid query params", async (query) => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      query as m2mGatewayApiV3.GetProducerDelegationsQueryParams
    );

    expect(res.status).toBe(400);
  });

  it.each([
    {
      ...mockM2MDelegationsResponse,
      results: [
        { ...mockM2MDelegationsResponse.results[0], kind: "invalidKind" },
      ],
    },
    {
      ...mockM2MDelegationsResponse,
      pagination: {
        offset: "invalidOffset",
        limit: "invalidLimit",
        totalCount: 0,
      },
    },
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockDelegationService.getProducerDelegations = vi
        .fn()
        .mockResolvedValueOnce(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, mockQueryParams);

      expect(res.status).toBe(500);
    }
  );

  it("Should return 500 in case of unexpectedDelegationKind error", async () => {
    mockDelegationService.getProducerDelegations = vi
      .fn()
      .mockRejectedValue(unexpectedDelegationKind(mockApiDelegation1));
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, mockQueryParams);

    expect(res.status).toBe(500);
  });
});
