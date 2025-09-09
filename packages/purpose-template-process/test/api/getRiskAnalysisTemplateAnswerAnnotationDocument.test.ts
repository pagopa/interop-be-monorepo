/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { AuthRole, authRole } from "pagopa-interop-commons";
import {
  generateToken,
  getMockRiskAnalysisTemplateAnswerAnnotationDocument,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  PurposeTemplateId,
  RiskAnalysisSingleAnswerId,
  RiskAnalysisTemplateAnswerAnnotationDocumentId,
  generateId,
} from "pagopa-interop-models";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { purposeTemplateApi } from "pagopa-interop-api-clients";
import { api, purposeTemplateService } from "../vitest.api.setup.js";
import { annotationDocumentToApiAnnotationDocument } from "../../src/model/domain/apiConverter.js";
import { riskAnalysisTemplateAnswerAnnotationDocumentNotFound } from "../../src/model/domain/errors.js";

describe("API GET /purposeTemplates/{purposeTemplateId}/riskAnalysis/answers/{answerId}/annotation/documents/{documentId}", () => {
  const purposeTemplateId = generateId<PurposeTemplateId>();
  const answerId = generateId<RiskAnalysisSingleAnswerId>();
  const riskAnalysisTemplateAnswerAnnotationDocument =
    getMockRiskAnalysisTemplateAnswerAnnotationDocument();

  const serviceResponse = getMockWithMetadata(
    riskAnalysisTemplateAnswerAnnotationDocument
  );
  const apiResponse =
    purposeTemplateApi.RiskAnalysisTemplateAnswerAnnotationDocument.parse(
      annotationDocumentToApiAnnotationDocument(
        riskAnalysisTemplateAnswerAnnotationDocument
      )
    );

  beforeEach(() => {
    purposeTemplateService.getRiskAnalysisTemplateAnswerAnnotationDocument = vi
      .fn()
      .mockResolvedValue(serviceResponse);
  });

  type MakeRequestParams = {
    pId?: PurposeTemplateId;
    aId?: RiskAnalysisSingleAnswerId;
    dId?: RiskAnalysisTemplateAnswerAnnotationDocumentId;
  };

  const makeRequest = async (
    token: string,
    { pId, aId, dId }: MakeRequestParams = {
      pId: purposeTemplateId,
      aId: answerId,
      dId: riskAnalysisTemplateAnswerAnnotationDocument.id,
    }
  ) =>
    request(api)
      .get(
        `/purposeTemplates/${pId}/riskAnalysis/answers/${aId}/annotation/documents/${dId}`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.API_ROLE,
    authRole.M2M_ROLE,
    authRole.M2M_ADMIN_ROLE,
    authRole.SECURITY_ROLE,
    authRole.SUPPORT_ROLE,
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

  // TODO: add errors
  it.each([
    {
      error: riskAnalysisTemplateAnswerAnnotationDocumentNotFound({
        purposeTemplateId,
        answerId,
        documentId: riskAnalysisTemplateAnswerAnnotationDocument.id,
      }),
      expectedStatus: 404,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      purposeTemplateService.getRiskAnalysisTemplateAnswerAnnotationDocument =
        vi.fn().mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it("Should return 400 if passed an invalid purpose template id", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid" as MakeRequestParams);
    expect(res.status).toBe(400);
  });
});
