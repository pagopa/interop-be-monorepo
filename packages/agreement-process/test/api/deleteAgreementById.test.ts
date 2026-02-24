/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AgreementId, agreementState, generateId } from "pagopa-interop-models";
import { generateToken, getMockAgreement } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, agreementService } from "../vitest.api.setup.js";
import {
  agreementNotFound,
  agreementNotInExpectedState,
  tenantIsNotTheConsumer,
  tenantIsNotTheDelegateConsumer,
} from "../../src/model/domain/errors.js";

describe("API POST /agreements/{agreementId} test", () => {
  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];
  const mockAgreement = getMockAgreement();

  beforeEach(() => {
    agreementService.deleteAgreementById = vi.fn().mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    agreementId: AgreementId = mockAgreement.id
  ) =>
    request(api)
      .delete(`/agreements/${agreementId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  it.each(authorizedRoles)(
    "Should return 204 for user with role Admin",
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
    { error: agreementNotFound(mockAgreement.id), expectedStatus: 404 },
    {
      error: agreementNotInExpectedState(
        mockAgreement.id,
        agreementState.active
      ),
      expectedStatus: 400,
    },
    { error: tenantIsNotTheConsumer(generateId()), expectedStatus: 403 },
    {
      error: tenantIsNotTheDelegateConsumer(generateId(), undefined),
      expectedStatus: 403,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      agreementService.deleteAgreementById = vi.fn().mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([{ agreementId: "invalid" as AgreementId }])(
    "Should return 400 if passed invalid data: %s",
    async ({ agreementId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, agreementId);
      expect(res.status).toBe(400);
    }
  );
});
