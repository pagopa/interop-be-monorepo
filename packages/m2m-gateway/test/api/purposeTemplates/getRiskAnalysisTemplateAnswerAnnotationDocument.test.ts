import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiRiskAnalysisTemplateAnswerAnnotationDocument,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { generateId } from "pagopa-interop-models";
import { api, mockPurposeTemplateService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("GET /purposeTemplates/:purposeTemplateId/riskAnalysis/answers/:answerId/annotation/documents/:documentId router test", () => {
  const authorizedRoles: AuthRole[] = [
    authRole.M2M_ADMIN_ROLE,
    authRole.M2M_ROLE,
  ];

  const mockM2MRiskAnalysisTemplateAnswerAnnotationDocumentResponse =
    getMockedApiRiskAnalysisTemplateAnswerAnnotationDocument();

  const makeRequest = async (
    token: string,
    purposeTemplateId: string = generateId(),
    answerId: string = generateId(),
    documentId: string = mockM2MRiskAnalysisTemplateAnswerAnnotationDocumentResponse.id
  ) =>
    request(api)
      .get(
        `${appBasePath}/purposeTemplates/${purposeTemplateId}/riskAnalysis/answers/${answerId}/annotation/documents/${documentId}`
      )
      .set("Authorization", `Bearer ${token}`)
      .send();

  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockPurposeTemplateService.getRiskAnalysisTemplateAnswerAnnotationDocument =
        vi
          .fn()
          .mockResolvedValue(
            mockM2MRiskAnalysisTemplateAnswerAnnotationDocumentResponse
          );

      const token = generateToken(role);
      const res = await makeRequest(token);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(
        mockM2MRiskAnalysisTemplateAnswerAnnotationDocumentResponse
      );
    }
  );

  it.each([
    {
      purposeTemplateId: "invalid-id",
      answerId: generateId(),
      documentId: generateId(),
    },
    {
      purposeTemplateId: generateId(),
      answerId: "invalid-id",
      documentId: generateId(),
    },
    {
      purposeTemplateId: generateId(),
      answerId: generateId(),
      documentId: "invalid-id",
    },
  ])(
    "Should return 400 if invalid parameters are passed: %s",
    async ({ purposeTemplateId, answerId, documentId }) => {
      mockPurposeTemplateService.getRiskAnalysisTemplateAnswerAnnotationDocument =
        vi
          .fn()
          .mockResolvedValue(
            mockM2MRiskAnalysisTemplateAnswerAnnotationDocumentResponse
          );

      const token = generateToken(authRole.M2M_ROLE);
      const res = await makeRequest(
        token,
        purposeTemplateId,
        answerId,
        documentId
      );
      expect(res.status).toBe(400);
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
      ...mockM2MRiskAnalysisTemplateAnswerAnnotationDocumentResponse,
      createdAt: undefined,
    },
    {
      ...mockM2MRiskAnalysisTemplateAnswerAnnotationDocumentResponse,
      id: "invalidId",
    },
    {
      ...mockM2MRiskAnalysisTemplateAnswerAnnotationDocumentResponse,
      extraParam: "extraValue",
    },
    {},
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockPurposeTemplateService.getRiskAnalysisTemplateAnswerAnnotationDocument =
        vi.fn().mockResolvedValue(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token);

      expect(res.status).toBe(500);
    }
  );
});
