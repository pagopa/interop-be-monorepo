/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { delegationApi } from "pagopa-interop-api-clients";
import { generateToken, getMockDelegation } from "pagopa-interop-commons-test";
import { Delegation, delegationKind, generateId } from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { delegationToApiDelegation } from "../../src/model/domain/apiConverter.js";
import { delegationService } from "../integrationUtils.js";
import { api } from "../vitest.api.setup.js";

describe("API GET /delegations test", () => {
  const mockDelegation1: Delegation = getMockDelegation({
    kind: delegationKind.delegatedConsumer,
  });
  const mockDelegation2: Delegation = getMockDelegation({
    kind: delegationKind.delegatedConsumer,
  });
  const mockDelegation3: Delegation = getMockDelegation({
    kind: delegationKind.delegatedConsumer,
  });

  const mockDelegations = {
    results: [mockDelegation1, mockDelegation2, mockDelegation3],
    totalCount: 3,
  };

  const apiDelegations = delegationApi.Delegations.parse({
    results: mockDelegations.results.map(delegationToApiDelegation),
    totalCount: mockDelegations.totalCount,
  });

  delegationService.getDelegations = vi.fn().mockResolvedValue(apiDelegations);

  const makeRequest = async (token: string, limit: unknown = 10) =>
    request(api)
      .get("/delegations")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query({ offset: 0, limit });

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.API_ROLE,
    authRole.SECURITY_ROLE,
    authRole.M2M_ROLE,
    authRole.SUPPORT_ROLE,
  ];

  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiDelegations);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 400 if passed an invalid parameter", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid");
    expect(res.status).toBe(400);
  });
});
