/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { constants } from "http2";
import { AuthRole, authRole } from "pagopa-interop-commons";
import {
  generateToken,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  generateId,
  PurposeTemplateId,
  purposeTemplateState,
  RiskAnalysisMultiAnswerId,
  RiskAnalysisSingleAnswerId,
} from "pagopa-interop-models";
import request from "supertest";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { purposeTemplateApi } from "pagopa-interop-api-clients";
import { api, purposeTemplateService } from "../vitest.api.setup.js";
import {
  annotationDocumentLimitExceeded,
  conflictDocumentPrettyNameDuplicate,
  conflictDuplicatedDocument,
  purposeTemplateNotFound,
  purposeTemplateNotInExpectedStates,
  purposeTemplateRiskAnalysisFormNotFound,
  riskAnalysisTemplateAnswerAnnotationNotFound,
  riskAnalysisTemplateAnswerNotFound,
  tenantNotAllowed,
} from "../../src/model/domain/errors.js";

const {
  HTTP_STATUS_CONFLICT,
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_FORBIDDEN,
  HTTP_STATUS_NOT_FOUND,
} = constants;

describe("API POST /purposeTemplates/{id}/riskAnalysis/answers/{answerId}/annotation/documents", () => {
  const mockDate = new Date();
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];

  const purposeTemplateId = generateId<PurposeTemplateId>();
  const answerId = generateId<
    RiskAnalysisSingleAnswerId | RiskAnalysisMultiAnswerId
  >();
  const documentId = generateId();
  const validAnnotationDocumentSeed: purposeTemplateApi.RiskAnalysisTemplateAnswerAnnotationDocumentSeed =
    {
      documentId,
      name: "A Document",
      prettyName: "A Document",
      path: "/annotation/documents",
      contentType: "application/pdf",
      checksum:
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    };

  const expectedResponse: purposeTemplateApi.RiskAnalysisTemplateAnswerAnnotationDocument =
    {
      id: documentId,
      name: validAnnotationDocumentSeed.name,
      contentType: validAnnotationDocumentSeed.contentType,
      prettyName: validAnnotationDocumentSeed.prettyName,
      path: validAnnotationDocumentSeed.path,
      checksum: validAnnotationDocumentSeed.checksum,
      createdAt: mockDate.toISOString(),
    };

  const annotationDocumentResponse = getMockWithMetadata(expectedResponse, 0);

  beforeEach(() => {
    purposeTemplateService.addRiskAnalysisTemplateAnswerAnnotationDocument = vi
      .fn()
      .mockResolvedValue({
        ...annotationDocumentResponse,
        data: {
          ...annotationDocumentResponse.data,
          createdAt: mockDate,
        },
      });
  });

  const makeRequest = async (
    token: string,
    purposeTemplateId: string,
    answerId: string,
    annotationDocumentSeed: purposeTemplateApi.RiskAnalysisTemplateAnswerAnnotationDocumentSeed
  ) =>
    request(api)
      .post(
        `/purposeTemplates/${purposeTemplateId}/riskAnalysis/answers/${answerId}/annotation/documents`
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
        validAnnotationDocumentSeed
      );
      expect(res.status).toBe(200);
      expect(res.body).toEqual(annotationDocumentResponse.data);
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
      expectedStatus: HTTP_STATUS_BAD_REQUEST,
    },
    {
      error: purposeTemplateRiskAnalysisFormNotFound(purposeTemplateId),
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
      error: conflictDuplicatedDocument(
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
      error: annotationDocumentLimitExceeded(answerId),
      expectedStatus: HTTP_STATUS_CONFLICT,
    },
    {
      error: tenantNotAllowed(generateId()),
      expectedStatus: HTTP_STATUS_FORBIDDEN,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      purposeTemplateService.addRiskAnalysisTemplateAnswerAnnotationDocument =
        vi.fn().mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        purposeTemplateId,
        answerId,
        validAnnotationDocumentSeed
      );
      expect(res.status).toBe(expectedStatus);
    }
  );
});
