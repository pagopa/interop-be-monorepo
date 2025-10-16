import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  generateId,
  RiskAnalysisSingleAnswerId,
  RiskAnalysisTemplateAnswerAnnotationId,
} from "pagopa-interop-models";
import request from "supertest";
import { bffApi } from "pagopa-interop-api-clients";
import { generateToken } from "pagopa-interop-commons-test/src/mockedPayloadForToken.js";
import { authRole } from "pagopa-interop-commons";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { api, clients } from "../../vitest.api.setup.js";

describe("API POST /purposeTemplates/:id/riskAnalysis/answers", () => {
  const mockPurposeTemplateId = generateId();
  const mockRiskAnalysisAnswerRequest: bffApi.RiskAnalysisTemplateAnswerRequest =
    {
      answerKey: "purpose",
      answerData: {
        values: ["INSTITUTIONAL"],
        editable: false,
        suggestedValues: [],
        annotation: {
          text: "Risk analysis template answer annotation text",
          docs: [],
        },
      },
    };

  const mockCreatedRiskAnalysisAnswer: bffApi.RiskAnalysisTemplateAnswerResponse =
    {
      id: generateId<RiskAnalysisSingleAnswerId>(),
      values: ["INSTITUTIONAL"],
      editable: false,
      suggestedValues: [],
      annotation: {
        id: generateId<RiskAnalysisTemplateAnswerAnnotationId>(),
        text: "Risk analysis template answer annotation text",
        docs: [],
      },
    };

  beforeEach(() => {
    clients.purposeTemplateProcessClient.addRiskAnalysisAnswerForPurposeTemplate =
      vi.fn().mockResolvedValue(mockCreatedRiskAnalysisAnswer);
  });

  const makeRequest = async (
    token: string,
    purposeTemplateId: string = mockPurposeTemplateId,
    body: bffApi.RiskAnalysisTemplateAnswerRequest = mockRiskAnalysisAnswerRequest
  ): Promise<request.Response> =>
    request(api)
      .post(
        `${appBasePath}/purposeTemplates/${purposeTemplateId}/riskAnalysis/answers`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockCreatedRiskAnalysisAnswer);
  });

  it.each([
    { description: "empty body", body: {} },
    {
      description: "missing answerKey",
      body: { answerData: mockRiskAnalysisAnswerRequest.answerData },
    },
    {
      description: "missing answerData",
      body: { answerKey: mockRiskAnalysisAnswerRequest.answerKey },
    },
    {
      description: "invalid answerKey type",
      body: {
        answerKey: 123,
        answerData: mockRiskAnalysisAnswerRequest.answerData,
      },
    },
  ])("Should return 400 for %s", async ({ body }) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(
      token,
      mockPurposeTemplateId,
      body as unknown as bffApi.RiskAnalysisTemplateAnswerRequest
    );
    expect(res.status).toBe(400);
  });
});
