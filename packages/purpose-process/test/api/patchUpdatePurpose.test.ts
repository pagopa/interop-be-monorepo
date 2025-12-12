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
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
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
  eserviceNotFound,
  tenantNotFound,
  tenantKindNotFound,
} from "../../src/model/domain/errors.js";
import { buildRiskAnalysisSeed } from "../mockUtils.js";

describe("API PATCH /purposes/{purposeId} test", () => {
  const mockPurposeUpdateContent: purposeApi.PatchPurposeUpdateContent = {
    title: "Mock purpose title",
    dailyCalls: 10,
    description: "Mock purpose description",
    isFreeOfCharge: true,
    freeOfChargeReason: "Mock free of charge reason",
    riskAnalysisForm: buildRiskAnalysisSeed(
      getMockValidRiskAnalysis(tenantKind.PA)
    ),
  };
  const mockPurpose: Purpose = getMockPurpose();
  const isRiskAnalysisValid = true;

  const apiResponse = purposeApi.Purpose.parse(
    purposeToApiPurpose(mockPurpose, isRiskAnalysisValid)
  );

  const processResponse = getMockWithMetadata({
    purpose: mockPurpose,
    isRiskAnalysisValid,
  });
  beforeEach(() => {
    purposeService.patchUpdatePurpose = vi
      .fn()
      .mockResolvedValue(processResponse);
  });

  const makeRequest = async (
    token: string,
    purposeId: PurposeId = mockPurpose.id,
    body: purposeApi.PatchPurposeUpdateContent = mockPurposeUpdateContent
  ) =>
    request(api)
      .patch(`/purposes/${purposeId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiResponse);
      expect(res.headers["x-metadata-version"]).toBe(
        processResponse.metadata.version.toString()
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
    {},
    { title: "updated title" },
    { description: "updated description" },
    {
      title: "updated title",
      description: "updated description",
    },
    {
      title: "updated title",
      description: "updated description",
      dailyCalls: 99,
    },

    // With nullable fields
    { freeOfChargeReason: null },
    { title: "updated title", isFreeOfCharge: false, freeOfChargeReason: null },
  ])(
    "Should return 200 with partial seed and nullable fields (seed #%#)",
    async (seed: purposeApi.PatchPurposeUpdateContent) => {
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, mockPurpose.id, seed);
      expect(res.status).toBe(200);
    }
  );

  it.each([
    {
      error: eServiceModeNotAllowed(generateId(), eserviceMode.deliver),
      expectedStatus: 400,
    },
    { error: missingFreeOfChargeReason(), expectedStatus: 400 },
    { error: riskAnalysisValidationFailed([]), expectedStatus: 400 },
    { error: purposeNotInDraftState(mockPurpose.id), expectedStatus: 400 },
    { error: tenantIsNotTheConsumer(generateId()), expectedStatus: 403 },
    {
      error: tenantIsNotTheDelegatedConsumer(
        generateId(),
        generateId<DelegationId>()
      ),
      expectedStatus: 403,
    },
    { error: purposeNotFound(mockPurpose.id), expectedStatus: 404 },
    {
      error: duplicatedPurposeTitle(mockPurpose.title),
      expectedStatus: 409,
    },
    { error: eserviceNotFound(generateId()), expectedStatus: 500 },
    { error: tenantNotFound(generateId()), expectedStatus: 500 },
    { error: tenantKindNotFound(generateId()), expectedStatus: 500 },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      purposeService.patchUpdatePurpose = vi.fn().mockRejectedValue(error);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it("Should return 400 if passed an invalid purpose id", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, "invalid" as PurposeId);
    expect(res.status).toBe(400);
  });

  it.each([
    { ...mockPurposeUpdateContent, dailyCalls: -1 },
    { ...mockPurposeUpdateContent, extraField: 1 },
  ])(
    "Should return 400 if passed an invalid seed (seed #%#)",
    async (seed: purposeApi.PatchPurposeUpdateContent) => {
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, mockPurpose.id, seed);
      expect(res.status).toBe(400);
    }
  );
});
