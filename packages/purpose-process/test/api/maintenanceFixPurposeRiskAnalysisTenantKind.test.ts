/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { PurposeId, RiskAnalysisId, generateId } from "pagopa-interop-models";
import {
  generateToken,
  getMockPurpose,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import { api, purposeService } from "../vitest.api.setup.js";
import {
  purposeNotFound,
  eserviceRiskAnalysisNotFound,
  tenantKindNotFound,
} from "../../src/model/domain/errors.js";

describe("API POST /maintenance/purposes/{purposeId}/riskAnalyses/{riskAnalysisId}/tenantKind/fix test", () => {
  const mockPurpose = getMockPurpose();
  const isRiskAnalysisValid = true;
  const serviceResponse = getMockWithMetadata({
    purpose: mockPurpose,
    isRiskAnalysisValid,
  });

  beforeEach(() => {
    purposeService.fixPurposeRiskAnalysisTenantKind = vi
      .fn()
      .mockResolvedValue(serviceResponse);
  });

  const makeRequest = async (
    token: string,
    purposeId: PurposeId = mockPurpose.id,
    riskAnalysisId: RiskAnalysisId = generateId<RiskAnalysisId>()
  ) =>
    request(api)
      .post(
        `/maintenance/purposes/${purposeId}/riskAnalyses/${riskAnalysisId}/tenantKind/fix`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  it("Should return 200 for user with role maintenance", async () => {
    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
  });

  it.each(
    Object.values(authRole).filter((role) => role !== authRole.INTERNAL_ROLE)
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 404 for purposeNotFound", async () => {
    purposeService.fixPurposeRiskAnalysisTenantKind = vi
      .fn()
      .mockRejectedValue(purposeNotFound(mockPurpose.id));

    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 404 for eserviceRiskAnalysisNotFound", async () => {
    const riskAnalysisId = generateId<RiskAnalysisId>();
    purposeService.fixPurposeRiskAnalysisTenantKind = vi
      .fn()
      .mockRejectedValue(
        eserviceRiskAnalysisNotFound(mockPurpose.eserviceId, riskAnalysisId)
      );

    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(token, mockPurpose.id, riskAnalysisId);
    expect(res.status).toBe(404);
  });

  it("Should return 404 for tenantKindNotFound", async () => {
    purposeService.fixPurposeRiskAnalysisTenantKind = vi
      .fn()
      .mockRejectedValue(tenantKindNotFound(mockPurpose.consumerId));

    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it.each([
    { purposeId: "invalid" as PurposeId },
    { riskAnalysisId: "invalid" as RiskAnalysisId },
  ])(
    "Should return 400 if passed invalid params: %s",
    async ({ purposeId, riskAnalysisId }) => {
      const token = generateToken(authRole.INTERNAL_ROLE);
      const res = await makeRequest(
        token,
        purposeId ?? mockPurpose.id,
        riskAnalysisId ?? generateId<RiskAnalysisId>()
      );
      expect(res.status).toBe(400);
    }
  );
});
