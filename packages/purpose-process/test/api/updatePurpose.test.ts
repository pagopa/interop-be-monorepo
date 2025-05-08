/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  DelegationId,
  Purpose,
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
  organizationIsNotTheConsumer,
  organizationIsNotTheDelegatedConsumer,
  purposeNotFound,
  purposeNotInDraftState,
  riskAnalysisValidationFailed,
} from "../../src/model/domain/errors.js";
import { buildRiskAnalysisSeed } from "../mockUtils.js";

describe("API POST /purposes/{purposeId} test", () => {
  const mockPurposeUpdateContent = {
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
    purposeId: string = mockPurpose.id
  ) =>
    request(api)
      .post(`/purposes/${purposeId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(mockPurposeUpdateContent);

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

  it("Should return 400 for eServiceModeNotAllowed", async () => {
    purposeService.updatePurpose = vi
      .fn()
      .mockRejectedValue(
        eServiceModeNotAllowed(generateId(), eserviceMode.deliver)
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(400);
  });

  it("Should return 400 for missingFreeOfChargeReason", async () => {
    purposeService.updatePurpose = vi
      .fn()
      .mockRejectedValue(missingFreeOfChargeReason());
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(400);
  });

  it("Should return 400 for riskAnalysisValidationFailed", async () => {
    purposeService.updatePurpose = vi
      .fn()
      .mockRejectedValue(riskAnalysisValidationFailed([]));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(400);
  });

  it("Should return 403 for organizationIsNotTheConsumer", async () => {
    purposeService.updatePurpose = vi
      .fn()
      .mockRejectedValue(organizationIsNotTheConsumer(generateId()));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 403 for purposeNotInDraftState", async () => {
    purposeService.updatePurpose = vi
      .fn()
      .mockRejectedValue(purposeNotInDraftState(mockPurpose.id));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 403 for organizationIsNotTheDelegatedConsumer", async () => {
    purposeService.updatePurpose = vi
      .fn()
      .mockRejectedValue(
        organizationIsNotTheDelegatedConsumer(
          generateId(),
          generateId<DelegationId>()
        )
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 404 for purposeNotFound", async () => {
    purposeService.updatePurpose = vi
      .fn()
      .mockRejectedValue(purposeNotFound(mockPurpose.id));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 409 for duplicatedPurposeTitle", async () => {
    purposeService.updatePurpose = vi
      .fn()
      .mockRejectedValue(
        duplicatedPurposeTitle(mockPurposeUpdateContent.title)
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(409);
  });

  it("Should return 400 if passed an invalid purpose id", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid");
    expect(res.status).toBe(400);
  });
});
