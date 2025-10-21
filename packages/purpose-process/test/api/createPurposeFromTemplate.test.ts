/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  DelegationId,
  Purpose,
  PurposeTemplateId,
  eserviceMode,
  generateId,
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
  eserviceNotLinkedToPurposeTemplate,
  invalidPurposeTenantKind,
  riskAnalysisMissingExpectedFieldError,
  riskAnalysisVersionMismatch,
  eServiceModeNotAllowed,
  riskAnalysisContainsNotEditableAnswers,
  riskAnalysisAnswerNotInSuggestValues,
  tenantKindNotFound,
  tenantNotFound,
} from "../../src/model/domain/errors.js";
import { getMockPurposeFromTemplateSeed } from "../mockUtils.js";

describe("API POST /templates/{purposeTemplateId}/purposes test", () => {
  const mockEService = getMockEService();
  const mockPurposeFromTemplateSeed = getMockPurposeFromTemplateSeed(
    mockEService.id
  );
  const mockPurpose: Purpose = getMockPurpose();

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
    purposeTemplateId: PurposeTemplateId = generateId(),
    body: purposeApi.PurposeFromTemplateSeed = mockPurposeFromTemplateSeed
  ) =>
    request(api)
      .post(`/templates/${purposeTemplateId}/purposes`)
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
    {
      error: purposeTemplateNotFound(generateId()),
      expectedStatus: 404,
    },
    {
      error: tenantNotFound(generateId()),
      expectedStatus: 400,
    },
    {
      error: tenantKindNotFound(generateId()),
      expectedStatus: 400,
    },
    {
      error: agreementNotFound(generateId(), generateId()),
      expectedStatus: 400,
    },
    {
      error: eserviceNotLinkedToPurposeTemplate(generateId(), generateId()),
      expectedStatus: 400,
    },
    {
      error: invalidPurposeTenantKind(tenantKind.PA, tenantKind.GSP),
      expectedStatus: 400,
    },
    {
      error: riskAnalysisMissingExpectedFieldError("test-key"),
      expectedStatus: 400,
    },
    {
      error: riskAnalysisContainsNotEditableAnswers(generateId(), "test-key"),
      expectedStatus: 400,
    },
    {
      error: riskAnalysisAnswerNotInSuggestValues(generateId(), "test-key"),
      expectedStatus: 400,
    },
    {
      error: riskAnalysisVersionMismatch("0", "1"),
      expectedStatus: 400,
    },
    {
      error: eServiceModeNotAllowed(generateId(), eserviceMode.deliver),
      expectedStatus: 400,
    },
    { error: riskAnalysisValidationFailed([]), expectedStatus: 400 },
    {
      error: duplicatedPurposeTitle(mockPurposeFromTemplateSeed.title),
      expectedStatus: 409,
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
    { purposeTemplateId: "invalid" as PurposeTemplateId },
    { body: {} },
    { body: { ...mockPurposeFromTemplateSeed, eserviceId: undefined } },
    { body: { ...mockPurposeFromTemplateSeed, eserviceId: "invalid" } },
    { body: { ...mockPurposeFromTemplateSeed, consumerId: undefined } },
    { body: { ...mockPurposeFromTemplateSeed, consumerId: "invalid" } },
    { body: { ...mockPurposeFromTemplateSeed, title: undefined } },
    { body: { ...mockPurposeFromTemplateSeed, title: "a" } },
    {
      body: {
        ...mockPurposeFromTemplateSeed,
        title: new Array(61).fill("a").join,
      },
    },
    {
      body: {
        ...mockPurposeFromTemplateSeed,
        dailyCalls: undefined,
      },
    },
    {
      body: {
        ...mockPurposeFromTemplateSeed,
        dailyCalls: -1,
      },
    },
    {
      body: {
        ...mockPurposeFromTemplateSeed,
        dailyCalls: 1000000001,
      },
    },
    { body: { ...mockPurposeFromTemplateSeed, extraField: 1 } },
  ])(
    "Should return 400 if passed invalid data: %s",
    async ({ purposeTemplateId, body }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        purposeTemplateId,
        body as purposeApi.PurposeFromTemplateSeed
      );
      expect(res.status).toBe(400);
    }
  );
});
