/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  PurposeTemplateId,
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
    answerId: string = answerWithoutAnnotation.id
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
      name: "invalid purpose template id",
      run: (token: string) =>
        makeRequest(token, "invalid" as PurposeTemplateId),
    },
    {
      name: "invalid answer id",
      run: (token: string) =>
        makeRequest(
          token,
          generateId<PurposeTemplateId>(),
          "invalid" as RiskAnalysisSingleAnswerId
        ),
    },
  ])("Should return 400 if an $name is passed", async ({ run }) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await run(token);

    expect(res.status).toBe(400);
  });
});
