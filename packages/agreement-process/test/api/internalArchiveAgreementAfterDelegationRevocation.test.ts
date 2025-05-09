/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  DelegationId,
  agreementState,
  generateId,
} from "pagopa-interop-models";
import { generateToken, getMockAgreement } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, agreementService } from "../vitest.api.setup.js";
import {
  agreementNotFound,
  agreementNotInExpectedState,
  organizationIsNotTheConsumer,
  organizationIsNotTheDelegateConsumer,
} from "../../src/model/domain/errors.js";

describe("API POST /internal/delegations/{delegationId}/agreements/{agreementId}/archive test", () => {
  const mockAgreement = getMockAgreement();

  beforeEach(() => {
    agreementService.internalArchiveAgreementAfterDelegationRevocation = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    delegationId: string = generateId<DelegationId>(),
    agreementId: string = mockAgreement.id
  ) =>
    request(api)
      .post(
        `/internal/delegations/${delegationId}/agreements/${agreementId}/archive`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  it("Should return 204 for user with role Internal", async () => {
    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(204);
  });

  it.each(
    Object.values(authRole).filter((role) => role !== authRole.INTERNAL_ROLE)
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 404 for agreementNotFound", async () => {
    agreementService.internalArchiveAgreementAfterDelegationRevocation = vi
      .fn()
      .mockRejectedValue(agreementNotFound(mockAgreement.id));
    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 400 for agreementNotInExpectedState", async () => {
    agreementService.internalArchiveAgreementAfterDelegationRevocation = vi
      .fn()
      .mockRejectedValue(
        agreementNotInExpectedState(mockAgreement.id, agreementState.draft)
      );
    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(400);
  });

  it("Should return 403 for organizationIsNotTheConsumer", async () => {
    agreementService.internalArchiveAgreementAfterDelegationRevocation = vi
      .fn()
      .mockRejectedValue(organizationIsNotTheConsumer(generateId()));
    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 403 for organizationIsNotTheDelegateConsumer", async () => {
    agreementService.internalArchiveAgreementAfterDelegationRevocation = vi
      .fn()
      .mockRejectedValue(
        organizationIsNotTheDelegateConsumer(
          generateId(),
          generateId<DelegationId>()
        )
      );
    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 400 if passed an invalid delegation id", async () => {
    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(token, "invalid");
    expect(res.status).toBe(400);
  });
});
