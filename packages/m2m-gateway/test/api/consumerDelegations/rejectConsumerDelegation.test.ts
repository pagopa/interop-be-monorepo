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

describe("POST /consumerDelegations/:delegationId/reject router test", () => {
  const mockApiDelegation = getMockedApiDelegation({
    kind: delegationApi.DelegationKind.Values.DELEGATED_CONSUMER,
    state: delegationApi.DelegationState.Values.REJECTED,
  });
  const mockM2MDelegationResponse: m2mGatewayApi.ConsumerDelegation =
    toM2MGatewayApiConsumerDelegation(mockApiDelegation.data);

  const makeRequest = async (
    token: string,
    delegationId: string,
    body: m2mGatewayApi.DelegationRejection
  ) =>
    request(api)
      .post(`${appBasePath}/consumerDelegations/${delegationId}/reject`)
      .set("Authorization", `Bearer ${token}`)
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockDelegationService.rejectConsumerDelegation = vi
        .fn()
        .mockResolvedValue(mockM2MDelegationResponse);

      const token = generateToken([role]);
      const res = await makeRequest(token, mockApiDelegation.data.id, {
        rejectionReason: "test reason",
      });

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MDelegationResponse);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken([role]);
    const res = await makeRequest(token, mockApiDelegation.data.id, {
      rejectionReason: "test reason",
    });
    expect(res.status).toBe(403);
  });

  it("Should return 400 if passed an invalid delegation id", async () => {
    const token = generateToken([authRole.M2M_ADMIN_ROLE]);
    const res = await makeRequest(token, "invalid-delegation-id", {
      rejectionReason: "test reason",
    });

    expect(res.status).toBe(400);
  });

  it.each([{ invalidParam: "invalidValue" }, {}, { rejectionReason: 42 }])(
    "Should return 400 if passed an invalid body: %s",
    async (body) => {
      const token = generateToken([authRole.M2M_ADMIN_ROLE]);
      const res = await makeRequest(
        token,
        mockApiDelegation.data.id,
        body as unknown as m2mGatewayApi.DelegationRejection
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
      mockDelegationService.rejectConsumerDelegation = vi
        .fn()
        .mockResolvedValueOnce(resp);
      const token = generateToken([authRole.M2M_ADMIN_ROLE]);
      const res = await makeRequest(token, mockApiDelegation.data.id, {
        rejectionReason: "test reason",
      });

      expect(res.status).toBe(500);
    }
  );

  it.each([
    missingMetadata(),
    unexpectedDelegationKind(mockApiDelegation.data),
    resourcePollingTimeout(3),
  ])("Should return 500 in case of $code error", async (error) => {
    mockDelegationService.rejectConsumerDelegation = vi
      .fn()
      .mockRejectedValue(error);
    const token = generateToken([authRole.M2M_ADMIN_ROLE]);
    const res = await makeRequest(token, mockApiDelegation.data.id, {
      rejectionReason: "test reason",
    });

    expect(res.status).toBe(500);
  });
});
