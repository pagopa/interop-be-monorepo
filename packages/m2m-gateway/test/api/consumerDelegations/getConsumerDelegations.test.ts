/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import { generateToken } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { delegationApi, m2mGatewayApi } from "pagopa-interop-api-clients";
import { api, mockDelegationService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { unexpectedDelegationKind } from "../../../src/model/errors.js";
import { toM2MGatewayApiConsumerDelegation } from "../../../src/api/delegationApiConverter.js";
import { getMockedApiDelegation } from "../../mockUtils.js";

describe("GET /consumerDelegations router test", () => {
  const mockApiDelegation1 = getMockedApiDelegation({
    kind: delegationApi.DelegationKind.Values.DELEGATED_CONSUMER,
  });
  const mockApiDelegation2 = getMockedApiDelegation({
    kind: delegationApi.DelegationKind.Values.DELEGATED_CONSUMER,
  });

  const mockM2MDelegationsResponse: m2mGatewayApi.ConsumerDelegations = {
    pagination: { offset: 0, limit: 10, totalCount: 2 },
    results: [
      toM2MGatewayApiConsumerDelegation(mockApiDelegation1.data),
      toM2MGatewayApiConsumerDelegation(mockApiDelegation2.data),
    ],
  };

  const mockQueryParams: m2mGatewayApi.GetConsumerDelegationsQueryParams = {
    states: ["WAITING_FOR_APPROVAL"],
    eserviceIds: [],
    delegateIds: [],
    delegatorIds: [],
    offset: 0,
    limit: 10,
  };

  const makeRequest = async (
    token: string,
    query: m2mGatewayApi.GetConsumerDelegationsQueryParams
  ) =>
    request(api)
      .get(`${appBasePath}/consumerDelegations`)
      .set("Authorization", `Bearer ${token}`)
      .query(query)
      .send();

  const authorizedRoles: AuthRole[] = [
    authRole.M2M_ADMIN_ROLE,
    authRole.M2M_ROLE,
  ];
  it.each(authorizedRoles)(
    "Should return 200 and perform API clients calls for user with role %s",
    async (role) => {
      mockDelegationService.getConsumerDelegations = vi
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
  ])("Should return 400 if passed invalid query params", async (query) => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      query as unknown as m2mGatewayApi.GetConsumerDelegationsQueryParams
    );

    expect(res.status).toBe(400);
  });

  it.each([unexpectedDelegationKind(mockApiDelegation1.data)])(
    "Should return 500 in case of $code error",
    async () => {
      mockDelegationService.getConsumerDelegations = vi
        .fn()
        .mockRejectedValue(unexpectedDelegationKind(mockApiDelegation1.data));
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, mockQueryParams);

      expect(res.status).toBe(500);
    }
  );
});
