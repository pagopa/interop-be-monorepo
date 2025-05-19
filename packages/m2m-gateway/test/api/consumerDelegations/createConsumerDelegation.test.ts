import { describe, it, expect, vi } from "vitest";
import { generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { delegationApi, m2mGatewayApi } from "pagopa-interop-api-clients";
import { api, mockDelegationService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import {
  missingMetadata,
  resourcePollingTimeout,
  unexpectedDelegationKind,
} from "../../../src/model/errors.js";
import { toM2MGatewayApiConsumerDelegation } from "../../../src/api/delegationApiConverter.js";
import { getMockedApiDelegation } from "../../mockUtils.js";

describe("POST /consumerDelegations router test", () => {
  const mockDelegationSeed: m2mGatewayApi.DelegationSeed = {
    eserviceId: generateId(),
    delegateId: generateId(),
  };

  const mockApiDelegation = getMockedApiDelegation({
    kind: delegationApi.DelegationKind.Values.DELEGATED_CONSUMER,
    eserviceId: mockDelegationSeed.eserviceId,
    delegateId: mockDelegationSeed.delegateId,
  });
  const mockM2MDelegationResponse: m2mGatewayApi.ConsumerDelegation =
    toM2MGatewayApiConsumerDelegation(mockApiDelegation.data);

  const makeRequest = async (
    token: string,
    body: m2mGatewayApi.DelegationSeed
  ) =>
    request(api)
      .post(`${appBasePath}/consumerDelegations`)
      .set("Authorization", `Bearer ${token}`)
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockDelegationService.createConsumerDelegation = vi
        .fn()
        .mockResolvedValue(mockM2MDelegationResponse);

      const token = generateToken(role);
      const res = await makeRequest(token, mockDelegationSeed);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MDelegationResponse);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockDelegationSeed);
    expect(res.status).toBe(403);
  });

  it.each([
    { ...mockDelegationSeed, invalidParam: "invalidValue" },
    { ...mockDelegationSeed, delegateId: undefined },
    { ...mockDelegationSeed, eserviceId: undefined },
    { ...mockDelegationSeed, eserviceId: "invalidId" },
    { ...mockDelegationSeed, delegateId: "invalidId" },
  ])(
    "Should return 400 if passed an invalid delegation seed: %s",
    async (body) => {
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(
        token,
        body as m2mGatewayApi.DelegationSeed
      );

      expect(res.status).toBe(400);
    }
  );

  it.each([
    { ...mockM2MDelegationResponse, kind: "invalidKind" },
    { ...mockM2MDelegationResponse, invalidParam: "invalidValue" },
    { ...mockM2MDelegationResponse, createdAt: undefined },
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockDelegationService.createConsumerDelegation = vi
        .fn()
        .mockResolvedValueOnce(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, mockDelegationSeed);

      expect(res.status).toBe(500);
    }
  );

  it.each([
    missingMetadata(),
    unexpectedDelegationKind(mockApiDelegation.data),
    resourcePollingTimeout(3),
  ])("Should return 500 in case of $code error", async (error) => {
    mockDelegationService.createConsumerDelegation = vi
      .fn()
      .mockRejectedValue(error);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, mockDelegationSeed);

    expect(res.status).toBe(500);
  });
});
