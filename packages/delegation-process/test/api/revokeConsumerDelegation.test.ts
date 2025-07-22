/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { generateToken, getMockDelegation } from "pagopa-interop-commons-test";
import {
  Delegation,
  DelegationId,
  delegationKind,
  generateId,
  TenantId,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";

import { api, delegationService } from "../vitest.api.setup.js";
import {
  delegationNotFound,
  incorrectState,
  operationRestrictedToDelegator,
} from "../../src/model/domain/errors.js";

describe("API DELETE /consumer/delegations/:delegationId test", () => {
  const mockDelegation: Delegation = getMockDelegation({
    kind: delegationKind.delegatedConsumer,
  });

  beforeEach(() => {
    delegationService.revokeConsumerDelegation = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    delegationId: DelegationId = mockDelegation.id
  ) =>
    request(api)
      .delete(`/consumer/delegations/${delegationId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  const authorizedRoles: AuthRole[] = [authRole.ADMIN_ROLE];

  it.each(authorizedRoles)(
    "Should return 204 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(204);
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
    { error: delegationNotFound(mockDelegation.id), expectedStatus: 404 },
    {
      error: operationRestrictedToDelegator(
        generateId<TenantId>(),
        mockDelegation.id
      ),
      expectedStatus: 403,
    },
    {
      error: incorrectState(mockDelegation.id, "Revoked", "WaitingForApproval"),
      expectedStatus: 409,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      delegationService.revokeConsumerDelegation = vi
        .fn()
        .mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it("Should return 400 if passed an invalid delegation id", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid" as DelegationId);
    expect(res.status).toBe(400);
  });
});
