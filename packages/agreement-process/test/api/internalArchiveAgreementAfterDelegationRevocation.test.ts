/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  AgreementId,
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
  tenantIsNotTheConsumer,
  tenantIsNotTheDelegateConsumer,
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
    delegationId: DelegationId = generateId(),
    agreementId: AgreementId = mockAgreement.id
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

  it.each([
    { error: agreementNotFound(mockAgreement.id), expectedStatus: 404 },
    {
      error: agreementNotInExpectedState(
        mockAgreement.id,
        agreementState.draft
      ),
      expectedStatus: 400,
    },
    { error: tenantIsNotTheConsumer(generateId()), expectedStatus: 403 },
    {
      error: tenantIsNotTheDelegateConsumer(
        generateId(),
        generateId<DelegationId>()
      ),
      expectedStatus: 403,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      agreementService.internalArchiveAgreementAfterDelegationRevocation = vi
        .fn()
        .mockRejectedValue(error);
      const token = generateToken(authRole.INTERNAL_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    { agreementId: "invalid" as AgreementId },
    { delegationId: "invalid" as DelegationId },
  ])(
    "Should return 400 if passed invalid data: %s",
    async ({ delegationId, agreementId }) => {
      const token = generateToken(authRole.INTERNAL_ROLE);
      const res = await makeRequest(token, delegationId, agreementId);
      expect(res.status).toBe(400);
    }
  );
});
