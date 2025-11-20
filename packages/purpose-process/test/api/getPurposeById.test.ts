/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import { Purpose, PurposeId, generateId } from "pagopa-interop-models";
import {
  generateToken,
  getMockPurpose,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { purposeApi } from "pagopa-interop-api-clients";
import { api, purposeService } from "../vitest.api.setup.js";
import { purposeToApiPurpose } from "../../src/model/domain/apiConverter.js";
import {
  tenantNotAllowed,
  purposeNotFound,
} from "../../src/model/domain/errors.js";

describe("API GET /purposes/{purposeId} test", () => {
  const mockPurpose: Purpose = getMockPurpose();
  const isRiskAnalysisValid = true;

  const mockPurposeWithRiskAnalysis = mockPurpose;
  const mockPurposeWithoutRiskAnalysis = {
    ...mockPurpose,
    riskAnalysisForm: undefined,
  };

  const serviceResponseWithRiskAnalysis = getMockWithMetadata({
    purpose: mockPurposeWithRiskAnalysis,
    isRiskAnalysisValid,
  });
  const serviceResponseWithoutRiskAnalysis = getMockWithMetadata({
    purpose: mockPurposeWithoutRiskAnalysis,
    isRiskAnalysisValid,
  });

  const apiResponseWithRiskAnalysis = purposeApi.Purpose.parse(
    purposeToApiPurpose(mockPurposeWithRiskAnalysis, isRiskAnalysisValid)
  );
  const apiResponseWithoutRiskAnalysis = purposeApi.Purpose.parse(
    purposeToApiPurpose(mockPurposeWithoutRiskAnalysis, isRiskAnalysisValid)
  );

  const makeRequest = async (
    token: string,
    purposeId: PurposeId = mockPurpose.id
  ) =>
    request(api)
      .get(`/purposes/${purposeId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.API_ROLE,
    authRole.SECURITY_ROLE,
    authRole.M2M_ROLE,
    authRole.M2M_ADMIN_ROLE,
    authRole.SUPPORT_ROLE,
  ];

  it("Should return 200 with riskAnalysisForm for ADMIN_ROLE", async () => {
    purposeService.getPurposeById = vi
      .fn()
      .mockResolvedValue(serviceResponseWithRiskAnalysis);
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(apiResponseWithRiskAnalysis);
    expect(res.headers["x-metadata-version"]).toBe(
      serviceResponseWithRiskAnalysis.metadata.version.toString()
    );
  });

  it.each([
    authRole.API_ROLE,
    authRole.SECURITY_ROLE,
    authRole.M2M_ROLE,
    authRole.M2M_ADMIN_ROLE,
    authRole.SUPPORT_ROLE,
  ])(
    "Should return 200 without riskAnalysisForm for user with role %s",
    async (role) => {
      purposeService.getPurposeById = vi
        .fn()
        .mockResolvedValue(serviceResponseWithoutRiskAnalysis);
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiResponseWithoutRiskAnalysis);
      expect(res.headers["x-metadata-version"]).toBe(
        serviceResponseWithoutRiskAnalysis.metadata.version.toString()
      );
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
    { error: purposeNotFound(mockPurpose.id), expectedStatus: 404 },
    { error: tenantNotAllowed(generateId()), expectedStatus: 403 },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      purposeService.getPurposeById = vi.fn().mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it("Should return 400 if passed an invalid purpose id", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid" as PurposeId);
    expect(res.status).toBe(400);
  });
});
