/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import {
  generateId,
  PurposeTemplateId,
  RiskAnalysisMultiAnswerId,
  RiskAnalysisSingleAnswerId,
  RiskAnalysisTemplateAnswerAnnotationDocumentId,
} from "pagopa-interop-models";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, services } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("API GET /purposeTemplates/{purposeTemplateId}/riskAnalysis/answers/{answerId}/annotation/documents/{documentId}", () => {
  const mockBuffer = Buffer.from("content");

  beforeEach(() => {
    services.purposeTemplateService.getRiskAnalysisTemplateAnswerAnnotationDocument =
      vi.fn().mockResolvedValue(mockBuffer);
  });

  const makeRequest = async (
    token: string,
    purposeTemplateId: PurposeTemplateId = generateId(),
    answerId:
      | RiskAnalysisSingleAnswerId
      | RiskAnalysisMultiAnswerId = generateId(),
    documentId: RiskAnalysisTemplateAnswerAnnotationDocumentId = generateId()
  ) =>
    request(api)
      .get(
        `${appBasePath}/purposeTemplates/${purposeTemplateId}/riskAnalysis/answers/${answerId}/annotation/documents/${documentId}`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockBuffer);
  });

  it.each([
    { purposeTemplateId: "invalid" as PurposeTemplateId },
    { answerId: "invalid" as RiskAnalysisMultiAnswerId },
    { documentId: "invalid" as RiskAnalysisTemplateAnswerAnnotationDocumentId },
  ])(
    "Should return 400 if passed an invalid data: %s",
    async ({ purposeTemplateId, answerId, documentId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        purposeTemplateId,
        answerId,
        documentId
      );
      expect(res.status).toBe(400);
    }
  );
});
