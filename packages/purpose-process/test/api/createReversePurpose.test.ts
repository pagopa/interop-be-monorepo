/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  DelegationId,
  Purpose,
  eserviceMode,
  generateId,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockEService,
  getMockPurpose,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { purposeApi } from "pagopa-interop-api-clients";
import { api, purposeService } from "../vitest.api.setup.js";
import { purposeToApiPurpose } from "../../src/model/domain/apiConverter.js";
import {
  agreementNotFound,
  duplicatedPurposeTitle,
  eServiceModeNotAllowed,
  eserviceNotFound,
  eserviceRiskAnalysisNotFound,
  missingFreeOfChargeReason,
  tenantIsNotTheConsumer,
  tenantIsNotTheDelegatedConsumer,
  riskAnalysisValidationFailed,
} from "../../src/model/domain/errors.js";
import { getMockReversePurposeSeed } from "../mockUtils.js";

describe("API POST /reverse/purposes test", () => {
  const mockEService = getMockEService();
  const mockReversePurposeSeed = getMockReversePurposeSeed(
    mockEService.id,
    generateId(),
    generateId()
  );
  const mockPurpose: Purpose = getMockPurpose();
  const isRiskAnalysisValid = true;
  const serviceResponse = getMockWithMetadata({
    purpose: mockPurpose,
    isRiskAnalysisValid,
  });

  const apiResponse = purposeToApiPurpose(mockPurpose, isRiskAnalysisValid);

  beforeEach(() => {
    purposeService.createReversePurpose = vi
      .fn()
      .mockResolvedValue(serviceResponse);
  });

  const makeRequest = async (
    token: string,
    body: purposeApi.ReversePurposeSeed = mockReversePurposeSeed
  ) =>
    request(api)
      .post("/reverse/purposes")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];

  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.body).toEqual(apiResponse);
      expect(res.status).toBe(200);
      expect(res.headers["x-metadata-version"]).toBe(
        serviceResponse.metadata.version.toString()
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
    { error: tenantIsNotTheConsumer(generateId()), expectedStatus: 403 },
    {
      error: tenantIsNotTheDelegatedConsumer(
        generateId(),
        generateId<DelegationId>()
      ),
      expectedStatus: 403,
    },
    { error: eserviceNotFound(mockEService.id), expectedStatus: 400 },
    {
      error: eServiceModeNotAllowed(mockEService.id, eserviceMode.receive),
      expectedStatus: 400,
    },
    {
      error: eserviceRiskAnalysisNotFound(mockEService.id, generateId()),
      expectedStatus: 400,
    },
    { error: missingFreeOfChargeReason(), expectedStatus: 400 },
    {
      error: agreementNotFound(generateId(), generateId()),
      expectedStatus: 400,
    },
    { error: riskAnalysisValidationFailed([]), expectedStatus: 400 },
    {
      error: duplicatedPurposeTitle(mockReversePurposeSeed.title),
      expectedStatus: 409,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      purposeService.createReversePurpose = vi.fn().mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    { body: {} },
    { body: { ...mockReversePurposeSeed, eserviceId: undefined } },
    { body: { ...mockReversePurposeSeed, eserviceId: "invalid" } },
    { body: { ...mockReversePurposeSeed, extraField: 1 } },
  ])("Should return 400 if passed invalid data: %s", async ({ body }) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, body as purposeApi.ReversePurposeSeed);
    expect(res.status).toBe(400);
  });
});
