/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { EServiceId, RiskAnalysisId, generateId } from "pagopa-interop-models";
import { generateToken, getMockEService } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import { api, catalogService } from "../vitest.api.setup.js";
import {
  eServiceNotFound,
  eServiceRiskAnalysisNotFound,
  tenantKindNotFound,
} from "../../src/model/domain/errors.js";

describe("API POST /maintenance/eservices/{eServiceId}/riskAnalyses/{riskAnalysisId}/tenantKind/fix test", () => {
  const mockEService = getMockEService();
  const defaultEServiceId = mockEService.id;
  const defaultRiskAnalysisId = generateId<RiskAnalysisId>();

  catalogService.fixEServiceRiskAnalysisTenantKind = vi
    .fn()
    .mockResolvedValue({ data: mockEService, metadata: { version: 1 } });

  const makeRequest = async (
    token: string,
    eServiceId: EServiceId = defaultEServiceId,
    riskAnalysisId: RiskAnalysisId = defaultRiskAnalysisId
  ) =>
    request(api)
      .post(
        `/maintenance/eservices/${eServiceId}/riskAnalyses/${riskAnalysisId}/tenantKind/fix`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  it("Should return 200 for user with role maintenance", async () => {
    const token = generateToken(authRole.MAINTENANCE_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
  });

  it.each(
    Object.values(authRole).filter((role) => role !== authRole.MAINTENANCE_ROLE)
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 404 for eServiceNotFound", async () => {
    catalogService.fixEServiceRiskAnalysisTenantKind = vi
      .fn()
      .mockRejectedValue(eServiceNotFound(defaultEServiceId));

    const token = generateToken(authRole.MAINTENANCE_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 404 for eServiceRiskAnalysisNotFound", async () => {
    catalogService.fixEServiceRiskAnalysisTenantKind = vi
      .fn()
      .mockRejectedValue(
        eServiceRiskAnalysisNotFound(defaultEServiceId, defaultRiskAnalysisId)
      );

    const token = generateToken(authRole.MAINTENANCE_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 404 for tenantKindNotFound", async () => {
    catalogService.fixEServiceRiskAnalysisTenantKind = vi
      .fn()
      .mockRejectedValue(tenantKindNotFound(mockEService.producerId));

    const token = generateToken(authRole.MAINTENANCE_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it.each([
    { eServiceId: "invalid" as EServiceId },
    { riskAnalysisId: "invalid" as RiskAnalysisId },
  ])(
    "Should return 400 if passed invalid params: %s",
    async ({ eServiceId, riskAnalysisId }) => {
      const token = generateToken(authRole.MAINTENANCE_ROLE);
      const res = await makeRequest(
        token,
        eServiceId ?? defaultEServiceId,
        riskAnalysisId ?? defaultRiskAnalysisId
      );
      expect(res.status).toBe(400);
    }
  );
});
