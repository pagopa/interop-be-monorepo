/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DelegationId, PurposeId, generateId } from "pagopa-interop-models";
import { generateToken, getMockPurpose } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, purposeService } from "../vitest.api.setup.js";
import {
  tenantIsNotTheConsumer,
  tenantIsNotTheDelegatedConsumer,
  purposeCannotBeDeleted,
  purposeNotFound,
} from "../../src/model/domain/errors.js";

describe("API DELETE /internal/delegations/{delegationId}/purposes/{id} test", () => {
  const mockPurpose = getMockPurpose();

  beforeEach(() => {
    purposeService.internalDeletePurposeAfterDelegationRevocation = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    delegationId: DelegationId = generateId(),
    purposeId: PurposeId = mockPurpose.id
  ) =>
    request(api)
      .delete(`/internal/delegations/${delegationId}/purposes/${purposeId}`)
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
    { error: purposeNotFound(mockPurpose.id), expectedStatus: 404 },
    { error: tenantIsNotTheConsumer(generateId()), expectedStatus: 403 },
    {
      error: tenantIsNotTheDelegatedConsumer(
        generateId(),
        generateId<DelegationId>()
      ),
      expectedStatus: 403,
    },
    { error: purposeCannotBeDeleted(mockPurpose.id), expectedStatus: 409 },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      purposeService.internalDeletePurposeAfterDelegationRevocation = vi
        .fn()
        .mockRejectedValue(error);
      const token = generateToken(authRole.INTERNAL_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    { delegationId: "invalid" as DelegationId },
    { purposeId: "invalid" as PurposeId },
  ])(
    "Should return 400 if passed invalid data: %s",
    async ({ delegationId, purposeId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, delegationId, purposeId);
      expect(res.status).toBe(400);
    }
  );
});
