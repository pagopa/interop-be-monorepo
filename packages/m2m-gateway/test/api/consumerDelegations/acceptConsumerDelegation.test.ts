/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
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

describe("POST /consumerDelegations/:delegationId/accept router test", () => {
  const mockApiDelegation = getMockedApiDelegation({
    kind: delegationApi.DelegationKind.Values.DELEGATED_CONSUMER,
    state: delegationApi.DelegationState.Values.ACTIVE,
  });
  const mockM2MDelegationResponse: m2mGatewayApi.ConsumerDelegation =
    toM2MGatewayApiConsumerDelegation(mockApiDelegation.data);

  const makeRequest = async (token: string, delegationId: string) =>
    request(api)
      .post(`${appBasePath}/consumerDelegations/${delegationId}/accept`)
      .set("Authorization", `Bearer ${token}`)
      .send();

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 and perform API clients calls for user with role %s",
    async (role) => {
      mockDelegationService.acceptConsumerDelegation = vi
        .fn()
        .mockResolvedValue(mockM2MDelegationResponse);

      const token = generateToken(role);
      const res = await makeRequest(token, mockApiDelegation.data.id);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MDelegationResponse);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockApiDelegation.data.id);
    expect(res.status).toBe(403);
  });

  it("Should return 400 if passed an invalid delegation id", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, "invalid-delegation-id");

    expect(res.status).toBe(400);
  });

  it("Should return 500 in case of missingMetadata error", async () => {
    mockDelegationService.acceptConsumerDelegation = vi
      .fn()
      .mockRejectedValue(missingMetadata());
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, mockApiDelegation.data.id);

    expect(res.status).toBe(500);
  });

  it("Should return 500 in case of unexpectedDelegationKind error", async () => {
    mockDelegationService.acceptConsumerDelegation = vi
      .fn()
      .mockRejectedValue(unexpectedDelegationKind(mockApiDelegation.data));
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, mockApiDelegation.data.id);

    expect(res.status).toBe(500);
  });

  it("Should return 500 in case of resourcePollingTimeout error", async () => {
    mockDelegationService.acceptConsumerDelegation = vi
      .fn()
      .mockRejectedValue(resourcePollingTimeout(3));
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, mockApiDelegation.data.id);

    expect(res.status).toBe(500);
  });
});
