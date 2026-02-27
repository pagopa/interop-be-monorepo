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

describe("API PUT /purposeTemplates/:id/riskAnalysis/answers/:answerId/annotation", () => {
  const mockPurposeTemplateId = generateId();
  const mockAnswerId = generateId<RiskAnalysisSingleAnswerId>();
  const mockRiskAnalysisAnswerAnnotationRequest: bffApi.RiskAnalysisTemplateAnswerAnnotationSeed =
    {
      text: "This is a new annotation text for the risk analysis answer",
    };

  const mockCreatedRiskAnalysisAnswerAnnotation: bffApi.RiskAnalysisTemplateAnswerAnnotation =
    {
      id: generateId<RiskAnalysisTemplateAnswerAnnotationId>(),
      text: "This is a new annotation text for the risk analysis answer",
      docs: [],
    };

  beforeEach(() => {
    clients.purposeTemplateProcessClient.addRiskAnalysisAnswerAnnotationForPurposeTemplate =
      vi.fn().mockResolvedValue(mockCreatedRiskAnalysisAnswerAnnotation);
  });

  const makeRequest = async (
    token: string,
    purposeTemplateId: string = mockPurposeTemplateId,
    answerId: string = mockAnswerId,
    body: bffApi.RiskAnalysisTemplateAnswerAnnotationSeed = mockRiskAnalysisAnswerAnnotationRequest
  ): Promise<request.Response> =>
    request(api)
      .put(
        `${appBasePath}/purposeTemplates/${purposeTemplateId}/riskAnalysis/answers/${answerId}/annotation`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockCreatedRiskAnalysisAnswerAnnotation);
  });

  it.each([
    { description: "empty body", body: {} },
    {
      description: "missing text",
      body: {},
    },
    {
      description: "invalid text type",
      body: {
        text: 123,
      },
    },
    {
      description: "empty text",
      body: {
        text: "",
      },
    },
    {
      description: "more than 2000 characters",
      body: {
        text: "T".repeat(2001),
      },
    },
  ])("Should return 400 for $description", async ({ body }) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(
      token,
      mockPurposeTemplateId,
      mockAnswerId,
      body as unknown as bffApi.RiskAnalysisTemplateAnswerAnnotationSeed
    );
    expect(res.status).toBe(400);
  });

  it("Should return 400 for invalid purpose template ID", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid-id");
    expect(res.status).toBe(400);
  });

  it("Should return 400 for invalid answer ID", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(
      token,
      mockPurposeTemplateId,
      "invalid-answer-id"
    );
    expect(res.status).toBe(400);
  });
});
