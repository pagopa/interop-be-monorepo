/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import {
  generateId,
  PurposeTemplateId,
  purposeTemplateState,
  RiskAnalysisTemplateAnswerAnnotationDocument,
  RiskAnalysisTemplateAnswerAnnotationDocumentId,
  WithMetadata,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockRiskAnalysisTemplateAnswerAnnotationDocument,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { api, purposeTemplateService } from "../vitest.api.setup.js";
import {
  purposeTemplateNotFound,
  purposeTemplateNotInExpectedStates,
  purposeTemplateRiskAnalysisFormNotFound,
} from "../../src/model/domain/errors.js";

describe("API /purposeTemplates/{id}/riskAnalysis/annotationDocuments/{documentId}", () => {
  const purposeTemplateId = generateId<PurposeTemplateId>();
  const annotationDocument =
    getMockRiskAnalysisTemplateAnswerAnnotationDocument();

  const serviceResponse: WithMetadata<RiskAnalysisTemplateAnswerAnnotationDocument> =
    getMockWithMetadata(annotationDocument);

  purposeTemplateService.deleteRiskAnalysisTemplateAnswerAnnotationDocument = vi
    .fn()
    .mockResolvedValue(serviceResponse);

  const makeRequest = async (
    token: string,
    id: PurposeTemplateId = purposeTemplateId,
    documentId: RiskAnalysisTemplateAnswerAnnotationDocumentId = annotationDocument.id
  ) =>
    request(api)
      .delete(
        `/purposeTemplates/${id}/riskAnalysis/annotationDocuments/${documentId}`
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
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      purposeTemplateService.deleteRiskAnalysisTemplateAnswerAnnotationDocument =
        vi.fn().mockRejectedValue(error);

      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, purposeTemplateId);

      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    {
      purposeTemplateId: "invalid-id" as PurposeTemplateId,
      documentId: generateId<RiskAnalysisTemplateAnswerAnnotationDocumentId>(),
    },
    {
      purposeTemplateId: generateId<PurposeTemplateId>(),
      documentId:
        "invalid-id" as RiskAnalysisTemplateAnswerAnnotationDocumentId,
    },
  ])(
    "Should return 400 if invalid parameters are passed: %s",
    async ({ purposeTemplateId, documentId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, purposeTemplateId, documentId);

      expect(res.status).toBe(400);
    }
  );
});
