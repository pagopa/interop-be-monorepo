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
import {
  delegationAlreadyExists,
  delegatorAndDelegateSameIdError,
  differentEServiceProducer,
  eserviceNotFound,
  originNotCompliant,
  tenantNotAllowedToDelegation,
  tenantNotFound,
} from "../../src/model/domain/errors.js";

describe("API POST /producer/delegations test", () => {
  const mockDelegator = { ...getMockTenant(), name: "Comune di Burione" };
  const mockDelegation: Delegation = getMockDelegation({
    kind: delegationKind.delegatedConsumer,
  });
  const mockEService: EService = getMockEService();

  const apiDelegation = delegationApi.Delegation.parse(
    delegationToApiDelegation(mockDelegation)
  );

  delegationService.createProducerDelegation = vi.fn().mockResolvedValue({
    data: mockDelegation,
    metadata: { version: 0 },
  });

  const makeRequest = async (
    token: string,
    delegateId: string = mockDelegator.id
  ) =>
    request(api)
      .post("/producer/delegations")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send({
        delegateId,
        eserviceId: mockEService.id,
      });

  const authorizedRoles: AuthRole[] = [authRole.ADMIN_ROLE];

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

  it("Should return 400 for eserviceNotFound", async () => {
    delegationService.createProducerDelegation = vi
      .fn()
      .mockRejectedValue(eserviceNotFound(mockEService.id));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(400);
  });

  it("Should return 400 for tenantNotFound", async () => {
    delegationService.createProducerDelegation = vi
      .fn()
      .mockRejectedValue(tenantNotFound(mockDelegator.id));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(400);
  });

  it("Should return 400 for invalidDelegatorAndDelegateIds", async () => {
    delegationService.createProducerDelegation = vi
      .fn()
      .mockRejectedValue(delegatorAndDelegateSameIdError());
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(400);
  });

  it("Should return 403 for originNotCompliant", async () => {
    delegationService.createProducerDelegation = vi
      .fn()
      .mockRejectedValue(originNotCompliant(mockDelegator, "Delegator"));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 403 for tenantNotAllowedToDelegation", async () => {
    delegationService.createProducerDelegation = vi
      .fn()
      .mockRejectedValue(
        tenantNotAllowedToDelegation(mockDelegator.id, "DelegatedConsumer")
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 403 for differentEserviceProducer", async () => {
    delegationService.createProducerDelegation = vi
      .fn()
      .mockRejectedValue(differentEServiceProducer(mockDelegator.id));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 409 for delegationAlreadyExists", async () => {
    delegationService.createProducerDelegation = vi
      .fn()
      .mockRejectedValue(
        delegationAlreadyExists(
          mockDelegator.id,
          mockEService.id,
          "DelegatedConsumer"
        )
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(409);
  });

  it("Should return 409 for delegationAlreadyExists", async () => {
    delegationService.createProducerDelegation = vi
      .fn()
      .mockRejectedValue(
        delegationAlreadyExists(
          generateId<TenantId>(),
          mockEService.id,
          "DelegatedProducer"
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
