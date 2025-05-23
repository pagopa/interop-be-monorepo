/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  DelegationId,
  Purpose,
  PurposeId,
  eserviceMode,
  generateId,
  tenantKind,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockPurpose,
  getMockValidRiskAnalysis,
} from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { purposeApi } from "pagopa-interop-api-clients";
import { api, purposeService } from "../vitest.api.setup.js";
import { purposeToApiPurpose } from "../../src/model/domain/apiConverter.js";
import {
  duplicatedPurposeTitle,
  eServiceModeNotAllowed,
  missingFreeOfChargeReason,
  tenantIsNotTheConsumer,
  tenantIsNotTheDelegatedConsumer,
  purposeNotFound,
  purposeNotInDraftState,
  riskAnalysisValidationFailed,
} from "../../src/model/domain/errors.js";
import { buildRiskAnalysisSeed } from "../mockUtils.js";

describe("API POST /purposes/{purposeId} test", () => {
  const mockPurposeUpdateContent: purposeApi.PurposeUpdateContent = {
    title: "Mock purpose title",
    dailyCalls: 10,
    description: "Mock purpose description",
    isFreeOfCharge: false,
    riskAnalysisForm: buildRiskAnalysisSeed(
      getMockValidRiskAnalysis(tenantKind.PA)
    ),
  };
  const mockPurpose: Purpose = getMockPurpose();
  const isRiskAnalysisValid = true;

  const apiResponse = purposeApi.Purpose.parse(
    purposeToApiPurpose(mockPurpose, isRiskAnalysisValid)
  );

  beforeEach(() => {
    purposeService.updatePurpose = vi
      .fn()
      .mockResolvedValue({ purpose: mockPurpose, isRiskAnalysisValid });
  });

  const makeRequest = async (
    token: string,
    purposeId: PurposeId = mockPurpose.id,
    body: purposeApi.PurposeUpdateContent = mockPurposeUpdateContent
  ) =>
    request(api)
      .post(`/purposes/${purposeId}`)
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
    {
      error: eServiceModeNotAllowed(generateId(), eserviceMode.deliver),
      expectedStatus: 400,
    },
    { error: missingFreeOfChargeReason(), expectedStatus: 400 },
    { error: riskAnalysisValidationFailed([]), expectedStatus: 400 },
    { error: tenantIsNotTheConsumer(generateId()), expectedStatus: 403 },
    { error: purposeNotInDraftState(mockPurpose.id), expectedStatus: 403 },
    {
      error: tenantIsNotTheDelegatedConsumer(
        generateId(),
        generateId<DelegationId>()
      ),
      expectedStatus: 403,
    },
    { error: purposeNotFound(mockPurpose.id), expectedStatus: 404 },
    {
      error: duplicatedPurposeTitle(mockPurposeUpdateContent.title),
      expectedStatus: 409,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      purposeService.updatePurpose = vi.fn().mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    { purposeId: "invalid" as PurposeId },
    { body: {} },
    { body: { ...mockPurposeUpdateContent, dailyCalls: -1 } },
    { body: { ...mockPurposeUpdateContent, extraField: 1 } },
  ])(
    "Should return 400 if passed invalid data: %s",
    async ({ purposeId, body }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        purposeId,
        body as purposeApi.PurposeUpdateContent
      );
      expect(res.status).toBe(400);
    }
  );
});
