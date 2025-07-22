/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { delegationApi } from "pagopa-interop-api-clients";
import { generateToken, getMockDelegation } from "pagopa-interop-commons-test";
import { Delegation, delegationKind, generateId } from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { delegationToApiDelegation } from "../../src/model/domain/apiConverter.js";

import { api, delegationService } from "../vitest.api.setup.js";

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

  const defaultQuery = {
    offset: 0,
    limit: 10,
    delegationStates: "ACTIVE,WAITING_FOR_APPROVAL",
    delegatorIds: `${generateId()},${generateId()}`,
    delegateIds: `${generateId()},${generateId()}`,
    eserviceIds: generateId(),
    kind: "DELEGATED_CONSUMER",
  };

  const mockDelegations = {
    results: [mockDelegation1, mockDelegation2, mockDelegation3],
    totalCount: 3,
  };

  const apiDelegations = delegationApi.Delegations.parse({
    results: mockDelegations.results.map(delegationToApiDelegation),
    totalCount: mockDelegations.totalCount,
  });

  beforeEach(() => {
    delegationService.getDelegations = vi
      .fn()
      .mockResolvedValue(mockDelegations);
  });

  const makeRequest = async (
    token: string,
    query: typeof defaultQuery = defaultQuery
  ) =>
    request(api)
      .get("/delegations")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query(query);

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.API_ROLE,
    authRole.SECURITY_ROLE,
    authRole.M2M_ROLE,
    authRole.M2M_ADMIN_ROLE,
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

  it.each([
    { query: {} },
    { query: { offset: 0 } },
    { query: { limit: 10 } },
    { query: { offset: -1, limit: 10 } },
    { query: { offset: 0, limit: -2 } },
    { query: { offset: 0, limit: 55 } },
    { query: { offset: "invalid", limit: 10 } },
    { query: { offset: 0, limit: "invalid" } },
    { query: { ...defaultQuery, delegationStates: "ACTIVE,invalid" } },
    { query: { ...defaultQuery, delegatorIds: `${generateId()},invalid` } },
    { query: { ...defaultQuery, delegateIds: `invalid,${generateId()}` } },
    { query: { ...defaultQuery, eserviceIds: `${generateId()},invalid` } },
    { query: { ...defaultQuery, kind: "INVALID_KIND" } },
  ])("Should return 400 if passed invalid data: %s", async ({ query }) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, query as typeof defaultQuery);
    expect(res.status).toBe(400);
  });
});
