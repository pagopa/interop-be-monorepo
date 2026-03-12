/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AgreementId, agreementState, generateId } from "pagopa-interop-models";
import { generateToken, getMockAgreement } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { agreementApi } from "pagopa-interop-api-clients";
import { api, agreementService } from "../vitest.api.setup.js";
import {
  agreementNotFound,
  agreementNotInExpectedState,
  tenantIsNotTheConsumer,
  tenantIsNotTheDelegateConsumer,
} from "../../src/model/domain/errors.js";
import { agreementToApiAgreement } from "../../src/model/domain/apiConverter.js";

describe("API POST /agreements/{agreementId}/update test", () => {
  const mockAgreement = getMockAgreement();
  const defaultBody: agreementApi.AgreementUpdatePayload = {
    consumerNotes: "Mock consumer notes",
  };

  const apiResponse = agreementApi.Agreement.parse(
    agreementToApiAgreement(mockAgreement)
  );

  beforeEach(() => {
    agreementService.updateAgreement = vi.fn().mockResolvedValue(mockAgreement);
  });

  const makeRequest = async (
    token: string,
    agreementId: AgreementId = mockAgreement.id,
    body: agreementApi.AgreementUpdatePayload = defaultBody
  ) =>
    request(api)
      .post(`/agreements/${agreementId}/update`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(apiResponse);
  });

  it.each(
    Object.values(authRole).filter((role) => role !== authRole.ADMIN_ROLE)
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
      agreementService.updateAgreement = vi.fn().mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    { agreementId: "invalid" as AgreementId },
    { body: {} },
    { body: { consumerNotes: 1 } },
    { body: { consumerNotes: new Array(1002).join("a") } },
    { body: { ...defaultBody, extraField: 1 } },
  ])(
    "Should return 400 if passed invalid data: %s",
    async ({ agreementId, body }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        agreementId,
        body as agreementApi.AgreementUpdatePayload
      );
      expect(res.status).toBe(400);
    }
  );
});
