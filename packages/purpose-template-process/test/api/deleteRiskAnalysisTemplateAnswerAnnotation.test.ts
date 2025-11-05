/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import {
  generateId,
  PurposeTemplateId,
  purposeTemplateState,
  RiskAnalysisMultiAnswerId,
  RiskAnalysisSingleAnswerId,
  RiskAnalysisTemplateSingleAnswer,
  tenantKind,
  WithMetadata,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockValidRiskAnalysisFormTemplate,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { api, purposeTemplateService } from "../vitest.api.setup.js";
import {
  purposeTemplateNotFound,
  purposeTemplateNotInExpectedStates,
  purposeTemplateRiskAnalysisFormNotFound,
  riskAnalysisTemplateAnswerNotFound,
  tenantNotAllowed,
} from "../../src/model/domain/errors.js";

describe("API /purposeTemplates/{id}/riskAnalysis/answers/{answerId}/annotation", () => {
  const purposeTemplateId = generateId<PurposeTemplateId>();
  const riskAnalysisTemplate = getMockValidRiskAnalysisFormTemplate(
    tenantKind.PA
  );
  const serviceResponse: WithMetadata<RiskAnalysisTemplateSingleAnswer> =
    getMockWithMetadata({
      ...riskAnalysisTemplate.singleAnswers[0],
      annotation: undefined,
    });

  purposeTemplateService.deleteRiskAnalysisTemplateAnswerAnnotation = vi
    .fn()
    .mockResolvedValue(serviceResponse);

  const makeRequest = async (
    token: string,
    id: PurposeTemplateId = purposeTemplateId,
    answerId:
      | RiskAnalysisSingleAnswerId
      | RiskAnalysisMultiAnswerId = serviceResponse.data.id
  ) =>
    request(api)
      .delete(
        `/purposeTemplates/${id}/riskAnalysis/answers/${answerId}/annotation`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];
  it.each(authorizedRoles)(
    "Should return 204 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(204);
      expect(res.body).toEqual({});
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
    {
      error: purposeTemplateNotInExpectedStates(
        purposeTemplateId,
        purposeTemplateState.published,
        [purposeTemplateState.draft]
      ),
      expectedStatus: 409,
    },
    {
      error: purposeTemplateNotFound(purposeTemplateId),
      expectedStatus: 404,
    },
    {
      error: purposeTemplateRiskAnalysisFormNotFound(purposeTemplateId),
      expectedStatus: 500,
    },
    {
      error: riskAnalysisTemplateAnswerNotFound(
        purposeTemplateId,
        serviceResponse.data.id
      ),
      expectedStatus: 404,
    },
    {
      error: tenantNotAllowed(generateId()),
      expectedStatus: 403,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      purposeTemplateService.deleteRiskAnalysisTemplateAnswerAnnotation = vi
        .fn()
        .mockRejectedValue(error);

      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, purposeTemplateId);

      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    {
      purposeTemplateId: "invalid-id" as PurposeTemplateId,
      answerId: generateId<RiskAnalysisSingleAnswerId>(),
    },
    {
      purposeTemplateId: generateId<PurposeTemplateId>(),
      answerId: "invalid-id" as RiskAnalysisSingleAnswerId,
    },
  ])(
    "Should return 400 if invalid data is passed: %s",
    async ({ purposeTemplateId, answerId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, purposeTemplateId, answerId);

      expect(res.status).toBe(400);
    }
  );
});
