/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { delegationApi } from "pagopa-interop-api-clients";
import {
  generateToken,
  getMockDelegation,
  getMockDelegationDocument,
} from "pagopa-interop-commons-test";
import {
  Delegation,
  DelegationContractDocument,
  delegationKind,
  generateId,
} from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { delegationContractToApiDelegationContract } from "../../src/model/domain/apiConverter.js";
import { delegationService } from "../integrationUtils.js";
import { api } from "../vitest.api.setup.js";
import { delegationContractNotFound } from "../../src/model/domain/errors.js";

describe("API GET /delegations/:delegationId/contracts/:contractId test", () => {
  const mockDelegation: Delegation = getMockDelegation({
    kind: delegationKind.delegatedConsumer,
  });
  const mockDelegationContract: DelegationContractDocument =
    getMockDelegationDocument();

  const apiDelegationContract = delegationApi.Delegation.parse({
    results: delegationContractToApiDelegationContract(mockDelegationContract),
  });

  delegationService.getDelegationContract = vi
    .fn()
    .mockResolvedValue(apiDelegationContract);

  const makeRequest = async (
    token: string,
    delegationContractId: string = mockDelegationContract.id
  ) =>
    request(api)
      .get(
        `/delegations/${mockDelegation.id}/contracts/${delegationContractId}`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query({ offset: 0, limit: 10 });

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
      expect(res.body).toEqual(apiDelegationContract);
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
    delegationService.getDelegationContract = vi
      .fn()
      .mockRejectedValue(
        delegationContractNotFound(mockDelegation.id, mockDelegationContract.id)
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 400 if passed an invalid parameter", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid");
    expect(res.status).toBe(400);
  });
});
