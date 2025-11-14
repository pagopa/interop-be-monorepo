/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { constants } from "http2";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  DelegationId,
  Purpose,
  PurposeTemplateId,
  eserviceMode,
  generateId,
  targetTenantKind,
  tenantKind,
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
  tenantIsNotTheConsumer,
  tenantIsNotTheDelegatedConsumer,
  riskAnalysisValidationFailed,
  purposeTemplateNotFound,
  invalidPurposeTenantKind,
  riskAnalysisMissingExpectedFieldError,
  riskAnalysisVersionMismatch,
  eServiceModeNotAllowed,
  riskAnalysisContainsNotEditableAnswers,
  riskAnalysisAnswerNotInSuggestValues,
  tenantKindNotFound,
  tenantNotFound,
  invalidPersonalData,
} from "../../src/model/domain/errors.js";
import { getMockPurposeFromTemplateSeed } from "../mockUtils.js";

const {
  HTTP_STATUS_NOT_FOUND,
  HTTP_STATUS_FORBIDDEN,
  HTTP_STATUS_CONFLICT,
  HTTP_STATUS_BAD_REQUEST,
} = constants;

describe("API POST /templates/{purposeTemplateId}/purposes test", () => {
  const mockEService = getMockEService();
  const mockPurposeFromTemplateSeed = getMockPurposeFromTemplateSeed(
    mockEService.id
  );
  const mockPurpose: Purpose = getMockPurpose();
  const purposeTemplateId = generateId<PurposeTemplateId>();

  const isRiskAnalysisValid = true;
  const serviceResponse = getMockWithMetadata({
    purpose: mockPurpose,
    isRiskAnalysisValid,
  });

  const apiResponse = purposeApi.Purpose.parse(
    purposeToApiPurpose(mockPurpose, isRiskAnalysisValid)
  );

  beforeEach(() => {
    purposeService.createPurposeFromTemplate = vi
      .fn()
      .mockResolvedValue(serviceResponse);
  });

  const makeRequest = async (
    token: string,
    templateId: PurposeTemplateId = purposeTemplateId,
    body: purposeApi.PurposeFromTemplateSeed = mockPurposeFromTemplateSeed
  ) =>
    request(api)
      .post(`/templates/${templateId}/purposes`)
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
      error: tenantIsNotTheConsumer(generateId()),
      expectedStatus: HTTP_STATUS_FORBIDDEN,
    },
    {
      error: tenantIsNotTheDelegatedConsumer(
        generateId(),
        generateId<DelegationId>()
      ),
      expectedStatus: HTTP_STATUS_FORBIDDEN,
    },
    {
      error: purposeTemplateNotFound(generateId()),
      expectedStatus: HTTP_STATUS_NOT_FOUND,
    },
    {
      error: tenantNotFound(generateId()),
      expectedStatus: HTTP_STATUS_BAD_REQUEST,
    },
    {
      error: tenantKindNotFound(generateId()),
      expectedStatus: HTTP_STATUS_BAD_REQUEST,
    },
    {
      error: agreementNotFound(generateId(), generateId()),
      expectedStatus: HTTP_STATUS_BAD_REQUEST,
    },
    {
      error: invalidPurposeTenantKind(tenantKind.PA, targetTenantKind.PRIVATE),
      expectedStatus: HTTP_STATUS_BAD_REQUEST,
    },
    {
      error: riskAnalysisMissingExpectedFieldError("test-key"),
      expectedStatus: HTTP_STATUS_BAD_REQUEST,
    },
    {
      error: riskAnalysisContainsNotEditableAnswers(generateId(), "test-key"),
      expectedStatus: HTTP_STATUS_BAD_REQUEST,
    },
    {
      error: riskAnalysisAnswerNotInSuggestValues(generateId(), "test-key"),
      expectedStatus: HTTP_STATUS_BAD_REQUEST,
    },
    {
      error: riskAnalysisVersionMismatch("0", "1"),
      expectedStatus: HTTP_STATUS_BAD_REQUEST,
    },
    {
      error: eServiceModeNotAllowed(generateId(), eserviceMode.deliver),
      expectedStatus: HTTP_STATUS_BAD_REQUEST,
    },
    {
      error: invalidPersonalData(undefined),
      expectedStatus: HTTP_STATUS_BAD_REQUEST,
    },
    {
      error: riskAnalysisValidationFailed([]),
      expectedStatus: HTTP_STATUS_BAD_REQUEST,
    },
    {
      error: duplicatedPurposeTitle(mockPurposeFromTemplateSeed.title),
      expectedStatus: HTTP_STATUS_CONFLICT,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      purposeService.createPurposeFromTemplate = vi
        .fn()
        .mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    {
      purposeTemplateId: "invalid" as PurposeTemplateId,
      body: mockPurposeFromTemplateSeed,
    },
    { purposeTemplateId, body: {} },
    {
      purposeTemplateId,
      body: { ...mockPurposeFromTemplateSeed, eserviceId: undefined },
    },
    {
      purposeTemplateId,
      body: { ...mockPurposeFromTemplateSeed, eserviceId: "invalid" },
    },
    {
      purposeTemplateId,
      body: { ...mockPurposeFromTemplateSeed, consumerId: undefined },
    },
    {
      purposeTemplateId,
      body: { ...mockPurposeFromTemplateSeed, consumerId: "invalid" },
    },
    {
      purposeTemplateId,
      body: { ...mockPurposeFromTemplateSeed, title: undefined },
    },
    { purposeTemplateId, body: { ...mockPurposeFromTemplateSeed, title: "a" } },
    {
      purposeTemplateId,
      body: {
        ...mockPurposeFromTemplateSeed,
        title: new Array(61).fill("a").join,
      },
    },
    {
      purposeTemplateId,
      body: {
        ...mockPurposeFromTemplateSeed,
        dailyCalls: undefined,
      },
    },
    {
      purposeTemplateId,
      body: {
        ...mockPurposeFromTemplateSeed,
        dailyCalls: -1,
      },
    },
    {
      purposeTemplateId,
      body: {
        ...mockPurposeFromTemplateSeed,
        dailyCalls: 1000000001,
      },
    },
    {
      purposeTemplateId,
      body: { ...mockPurposeFromTemplateSeed, extraField: 1 },
    },
  ])(
    "Should return 400 if passed invalid data: %s",
    async ({ purposeTemplateId, body }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        purposeTemplateId,
        body as purposeApi.PurposeFromTemplateSeed
      );
      expect(res.status).toBe(HTTP_STATUS_BAD_REQUEST);
    }
  );
});
