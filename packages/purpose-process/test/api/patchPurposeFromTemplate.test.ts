/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { constants } from "http2";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  Purpose,
  PurposeTemplateId,
  generateId,
  tenantKind,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockPurpose,
  getMockWithMetadata,
  mockAvailableDailysCalls,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { purposeApi } from "pagopa-interop-api-clients";
import { api, purposeService } from "../vitest.api.setup.js";
import { purposeToApiPurpose } from "../../src/model/domain/apiConverter.js";
import {
  duplicatedPurposeTitle,
  invalidPurposeTenantKind,
  purposeNotFound,
  purposeNotInDraftState,
  purposeTemplateNotFound,
  riskAnalysisAnswerNotInSuggestValues,
  riskAnalysisContainsNotEditableAnswers,
  riskAnalysisMissingExpectedFieldError,
  riskAnalysisValidationFailed,
  riskAnalysisVersionMismatch,
  tenantIsNotTheConsumer,
  tenantIsNotTheDelegatedConsumer,
  tenantKindNotFound,
} from "../../src/model/domain/errors.js";

const {
  HTTP_STATUS_NOT_FOUND,
  HTTP_STATUS_FORBIDDEN,
  HTTP_STATUS_CONFLICT,
  HTTP_STATUS_BAD_REQUEST,
} = constants;

describe("API PATCH /templates/{purposeTemplateId}/purposes/{purposeId} test", () => {
  const mockPurpose: Purpose = getMockPurpose();
  const mockPatchUpdateFromTemplateContent: purposeApi.PatchPurposeUpdateFromTemplateContent =
    {
      title: "Updated Purpose Title",
      dailyCalls: mockAvailableDailysCalls(),
    };

  const serviceResponse = getMockWithMetadata(mockPurpose, 2);

  const apiResponse = purposeApi.Purpose.parse(
    purposeToApiPurpose(mockPurpose, true)
  );

  beforeEach(() => {
    purposeService.updateDraftPurposeCreatedByTemplate = vi
      .fn()
      .mockResolvedValue(serviceResponse);
  });

  const makeRequest = async (
    token: string,
    purposeId: string = generateId(),
    purposeTemplateId: PurposeTemplateId = generateId(),
    body: purposeApi.PatchPurposeUpdateFromTemplateContent = mockPatchUpdateFromTemplateContent
  ) =>
    request(api)
      .patch(`/templates/${purposeTemplateId}/purposes/${purposeId}`)
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
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiResponse);
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
    expect(res.status).toBe(HTTP_STATUS_FORBIDDEN);
  });

  it.each([
    {
      error: riskAnalysisValidationFailed([]),
      expectedStatus: HTTP_STATUS_BAD_REQUEST,
    },
    {
      error: tenantKindNotFound(generateId()),
      expectedStatus: HTTP_STATUS_BAD_REQUEST,
    },
    {
      error: invalidPurposeTenantKind(tenantKind.PA, tenantKind.PRIVATE),
      expectedStatus: HTTP_STATUS_BAD_REQUEST,
    },
    {
      error: riskAnalysisVersionMismatch("99", "1"),
      expectedStatus: HTTP_STATUS_BAD_REQUEST,
    },
    {
      error: riskAnalysisMissingExpectedFieldError(generateId()),
      expectedStatus: HTTP_STATUS_BAD_REQUEST,
    },
    {
      error: riskAnalysisContainsNotEditableAnswers(generateId(), "Any"),
      expectedStatus: HTTP_STATUS_BAD_REQUEST,
    },
    {
      error: riskAnalysisAnswerNotInSuggestValues(generateId(), "Any"),
      expectedStatus: HTTP_STATUS_BAD_REQUEST,
    },
    {
      error: tenantIsNotTheConsumer(generateId()),
      expectedStatus: HTTP_STATUS_FORBIDDEN,
    },
    {
      error: tenantIsNotTheDelegatedConsumer(generateId(), undefined),
      expectedStatus: HTTP_STATUS_FORBIDDEN,
    },
    {
      error: purposeTemplateNotFound(generateId()),
      expectedStatus: HTTP_STATUS_NOT_FOUND,
    },
    {
      error: purposeNotFound(generateId()),
      expectedStatus: HTTP_STATUS_NOT_FOUND,
    },
    {
      error: purposeNotInDraftState(generateId()),
      expectedStatus: HTTP_STATUS_CONFLICT,
    },
    {
      error: duplicatedPurposeTitle("Any"),
      expectedStatus: HTTP_STATUS_CONFLICT,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      purposeService.updateDraftPurposeCreatedByTemplate = vi
        .fn()
        .mockRejectedValueOnce(error);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );
});
