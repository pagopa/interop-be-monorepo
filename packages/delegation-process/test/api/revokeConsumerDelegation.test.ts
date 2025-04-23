/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { generateToken, getMockDelegation } from "pagopa-interop-commons-test";
import { Delegation, delegationKind, generateId } from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { delegationService } from "../integrationUtils.js";
import { api } from "../vitest.api.setup.js";
import {
  delegationNotFound,
  incorrectState,
} from "../../src/model/domain/errors.js";

describe("API DELETE /consumer/delegations/:delegationId test", () => {
  const mockDelegation: Delegation = getMockDelegation({
    kind: delegationKind.delegatedConsumer,
  });

  delegationService.revokeConsumerDelegation = vi
    .fn()
    .mockResolvedValue(undefined);

  const makeRequest = async (
    token: string,
    delegationId: string = mockDelegation.id
  ) =>
    request(api)
      .delete(`/consumer/delegations/${delegationId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query({ offset: 0, limit: 10 });

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

  it("Should return 404 for delegationNotFound", async () => {
    delegationService.revokeConsumerDelegation = vi
      .fn()
      .mockRejectedValue(delegationNotFound(mockDelegation.id));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 409 for incorrectState", async () => {
    delegationService.revokeConsumerDelegation = vi
      .fn()
      .mockRejectedValue(
        incorrectState(mockDelegation.id, "Revoked", "WaitingForApproval")
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(409);
  });

  it("Should return 400 if passed an invalid parameter", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid");
    expect(res.status).toBe(400);
  });
});
