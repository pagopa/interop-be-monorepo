/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { delegationApi } from "pagopa-interop-api-clients";
import {
  generateToken,
  getMockDelegation,
  getMockEService,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  Delegation,
  EService,
  TenantId,
  delegationKind,
  generateId,
} from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, delegationService } from "../vitest.api.setup.js";
import { delegationToApiDelegation } from "../../src/model/domain/apiConverter.js";
import { delegationAlreadyExists } from "../../src/model/domain/errors.js";

describe("API POST /consumer/delegations test", () => {
  const mockDelegator = { ...getMockTenant(), name: "Comune di Burione" };
  const mockEservice: EService = getMockEService();
  const mockDelegation: Delegation = getMockDelegation({
    kind: delegationKind.delegatedConsumer,
  });

  const apiDelegation = delegationApi.Delegation.parse(
    delegationToApiDelegation(mockDelegation)
  );

  delegationService.createConsumerDelegation = vi.fn().mockResolvedValue({
    data: mockDelegation,
    metadata: { version: 0 },
  });

  const makeRequest = async (
    token: string,
    delegateId: string = mockDelegator.id
  ) =>
    request(api)
      .post("/consumer/delegations")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send({
        delegateId,
        eserviceId: mockEservice.id,
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
      expect(res.body).toEqual(apiDelegation);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 409 for delegationAlreadyExists", async () => {
    delegationService.createConsumerDelegation = vi
      .fn()
      .mockRejectedValue(
        delegationAlreadyExists(
          generateId<TenantId>(),
          mockEservice.id,
          "DelegatedConsumer"
        )
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
