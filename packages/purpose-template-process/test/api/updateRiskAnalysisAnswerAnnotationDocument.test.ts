/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { constants } from "http2";
import { purposeTemplateApi } from "pagopa-interop-api-clients";
import { AuthRole, authRole } from "pagopa-interop-commons";
import {
  generateToken,
  getMockRiskAnalysisTemplateAnswerAnnotationDocument,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  generateId,
  PurposeTemplateId,
  purposeTemplateState,
  RiskAnalysisMultiAnswerId,
  RiskAnalysisSingleAnswerId,
  RiskAnalysisTemplateAnswerAnnotationDocument,
  RiskAnalysisTemplateAnswerAnnotationDocumentId,
} from "pagopa-interop-models";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { annotationDocumentToApiAnnotationDocument } from "../../src/model/domain/apiConverter.js";
import {
  conflictDocumentPrettyNameDuplicate,
  purposeTemplateNotFound,
  purposeTemplateNotInExpectedStates,
  purposeTemplateRiskAnalysisFormNotFound,
  riskAnalysisTemplateAnswerAnnotationDocumentNotFound,
  riskAnalysisTemplateAnswerAnnotationNotFound,
  riskAnalysisTemplateAnswerNotFound,
  tenantNotAllowed,
} from "../../src/model/domain/errors.js";
import { api, purposeTemplateService } from "../vitest.api.setup.js";

const {
  HTTP_STATUS_OK,
  HTTP_STATUS_CONFLICT,
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_FORBIDDEN,
  HTTP_STATUS_NOT_FOUND,
} = constants;

describe("API POST /purposeTemplates/{id}/riskAnalysis/answers/{answerId}/annotation/{documentId}/update", () => {
  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];

  const purposeTemplateId = generateId<PurposeTemplateId>();
  const answerId = generateId<
    RiskAnalysisSingleAnswerId | RiskAnalysisMultiAnswerId
  >();
  const documentId =
    generateId<RiskAnalysisTemplateAnswerAnnotationDocumentId>();
  const mockAnnotationDocument: RiskAnalysisTemplateAnswerAnnotationDocument =
    getMockRiskAnalysisTemplateAnswerAnnotationDocument(documentId);
  const validAnnotationDocumentSeed: purposeTemplateApi.UpdateRiskAnalysisTemplateAnswerAnnotationDocumentSeed =
    {
      prettyName: "New Document pretty name",
    };

  const expectedResponse: RiskAnalysisTemplateAnswerAnnotationDocument = {
    ...mockAnnotationDocument,
    prettyName: validAnnotationDocumentSeed.prettyName,
  };

  const annotationDocumentResponse = getMockWithMetadata(expectedResponse, 0);

  beforeEach(() => {
    purposeTemplateService.updateRiskAnalysisTemplateAnswerAnnotationDocument =
      vi.fn().mockResolvedValue(annotationDocumentResponse);
  });

  const makeRequest = async (
    token: string,
    purposeTemplateId: string,
    answerId: string,
    documentId: string,
    annotationDocumentSeed: purposeTemplateApi.UpdateRiskAnalysisTemplateAnswerAnnotationDocumentSeed
  ) =>
    request(api)
      .post(
        `/purposeTemplates/${purposeTemplateId}/riskAnalysis/answers/${answerId}/annotation/documents/${documentId}/update`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(annotationDocumentSeed);

  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(
        token,
        purposeTemplateId,
        answerId,
        documentId,
        validAnnotationDocumentSeed
      );
      expect(res.status).toBe(HTTP_STATUS_OK);
      expect(res.body).toEqual(
        annotationDocumentToApiAnnotationDocument(
          annotationDocumentResponse.data
        )
      );
      expect(res.headers["x-metadata-version"]).toBe(
        annotationDocumentResponse.metadata.version.toString()
      );
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(
      token,
      purposeTemplateId,
      answerId,
      documentId,
      validAnnotationDocumentSeed
    );
    expect(res.status).toBe(HTTP_STATUS_FORBIDDEN);
  });

  it.each([
    {
      error: purposeTemplateNotFound(purposeTemplateId),
      expectedStatus: HTTP_STATUS_NOT_FOUND,
    },
    {
      error: purposeTemplateNotInExpectedStates(
        purposeTemplateId,
        purposeTemplateState.published,
        [purposeTemplateState.draft]
      ),
      expectedStatus: HTTP_STATUS_CONFLICT,
    },
    {
      error: purposeTemplateRiskAnalysisFormNotFound(purposeTemplateId),
      expectedStatus: HTTP_STATUS_NOT_FOUND,
    },
    {
      error: riskAnalysisTemplateAnswerAnnotationDocumentNotFound(
        purposeTemplateId,
        answerId,
        documentId
      ),
      expectedStatus: HTTP_STATUS_NOT_FOUND,
    },
    {
      error: riskAnalysisTemplateAnswerNotFound({
        purposeTemplateId,
        answerId,
      }),
      expectedStatus: HTTP_STATUS_NOT_FOUND,
    },
    {
      error: conflictDocumentPrettyNameDuplicate(
        answerId,
        validAnnotationDocumentSeed.prettyName
      ),
      expectedStatus: HTTP_STATUS_CONFLICT,
    },
    {
      error: riskAnalysisTemplateAnswerAnnotationNotFound(
        purposeTemplateId,
        answerId
      ),
      expectedStatus: HTTP_STATUS_NOT_FOUND,
    },
    {
      error: tenantNotAllowed(generateId()),
      expectedStatus: HTTP_STATUS_FORBIDDEN,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      purposeTemplateService.updateRiskAnalysisTemplateAnswerAnnotationDocument =
        vi.fn().mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        purposeTemplateId,
        answerId,
        documentId,
        validAnnotationDocumentSeed
      );
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    {
      purposeTemplateId: "invalid",
      answerId,
      documentId,
      body: validAnnotationDocumentSeed,
    },
    {
      purposeTemplateId,
      answerId: "invalid",
      documentId,
      body: validAnnotationDocumentSeed,
    },
    {
      purposeTemplateId,
      answerId,
      documentId: "invalid",
      body: validAnnotationDocumentSeed,
    },
    {
      purposeTemplateId,
      answerId,
      documentId,
      body: {},
    },
    {
      purposeTemplateId,
      answerId,
      documentId,
      body: {
        prettyName: "",
      },
    },
    {
      purposeTemplateId,
      answerId,
      documentId,
      body: {
        ...validAnnotationDocumentSeed,
        extraField: "test",
      },
    },
  ])(
    "Should return 400 if passed invalid data: %s",
    async ({ purposeTemplateId, answerId, documentId, body }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        purposeTemplateId,
        answerId,
        documentId,
        body as purposeTemplateApi.UpdateRiskAnalysisTemplateAnswerAnnotationDocumentSeed
      );
      expect(res.status).toBe(HTTP_STATUS_BAD_REQUEST);
    }
  );
});
