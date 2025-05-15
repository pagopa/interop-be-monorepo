/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { generateToken, getMockDelegation } from "pagopa-interop-commons-test";
import {
  Delegation,
  delegationKind,
  generateId,
  TenantId,
} from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";

import { api, delegationService } from "../vitest.api.setup.js";
import {
  delegationNotFound,
  incorrectState,
  operationRestrictedToDelegate,
} from "../../src/model/domain/errors.js";

describe("API POST /consumer/delegations/:delegationId/reject test", () => {
  const mockDelegation: Delegation = getMockDelegation({
    kind: delegationKind.delegatedConsumer,
  });

  delegationService.rejectConsumerDelegation = vi.fn().mockResolvedValue({
    data: mockDelegation,
    metadata: { version: 1 },
  });

  const makeRequest = async (
    token: string,
    delegationId: string = mockDelegation.id
  ) =>
    request(api)
      .post(`/consumer/delegations/${delegationId}/reject`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send({
        rejectionReason: "reason",
      });

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];

  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(200);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it.each([
    {
      error: operationRestrictedToDelegate(
        generateId<TenantId>(),
        mockDelegation.id
      ),
      expectedStatus: 403,
    },
    {
      error: delegationNotFound(mockDelegation.id),
      expectedStatus: 404,
    },
    {
      error: incorrectState(
        mockDelegation.id,
        "Rejected",
        "WaitingForApproval"
      ),
      expectedStatus: 409,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      delegationService.rejectConsumerDelegation = vi
        .fn()
        .mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it("Should return 400 if passed an invalid parameter", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid");
    expect(res.status).toBe(400);
  });
});
