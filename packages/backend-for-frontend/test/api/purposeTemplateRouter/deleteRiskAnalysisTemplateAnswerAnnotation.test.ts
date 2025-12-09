/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  PurposeTemplateId,
  RiskAnalysisMultiAnswerId,
  RiskAnalysisSingleAnswerId,
  RiskAnalysisTemplateSingleAnswer,
  generateId,
  tenantKind,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockValidRiskAnalysisFormTemplate,
} from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, clients } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("API DELETE /purposeTemplates/{purposeTemplateId}/riskAnalysis/answers/{answerId}/annotation test", () => {
  const riskAnalysisTemplate = getMockValidRiskAnalysisFormTemplate(
    tenantKind.PA
  );
  const answerWithoutAnnotation: RiskAnalysisTemplateSingleAnswer = {
    ...riskAnalysisTemplate.singleAnswers[0],
    annotation: undefined,
  };

  beforeEach(() => {
    clients.purposeTemplateProcessClient.deleteRiskAnalysisTemplateAnswerAnnotation =
      vi.fn().mockResolvedValue(answerWithoutAnnotation);
  });

  const makeRequest = async (
    token: string,
    purposeTemplateId: PurposeTemplateId = generateId(),
    answerId:
      | RiskAnalysisSingleAnswerId
      | RiskAnalysisMultiAnswerId = answerWithoutAnnotation.id
  ) =>
    request(api)
      .delete(
        `${appBasePath}/purposeTemplates/${purposeTemplateId}/riskAnalysis/answers/${answerId}/annotation`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  it("Should return 204 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(204);
  });

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
    "Should return 400 if invalid parameters are passed: %s",
    async ({ purposeTemplateId, answerId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, purposeTemplateId, answerId);

      expect(res.status).toBe(400);
    }
  );
});
