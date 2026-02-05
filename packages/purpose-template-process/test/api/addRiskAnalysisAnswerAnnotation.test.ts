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
  RiskAnalysisTemplateAnswerAnnotation,
} from "pagopa-interop-models";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { purposeTemplateApi } from "pagopa-interop-api-clients";
import { api, purposeTemplateService } from "../vitest.api.setup.js";
import { purposeTemplateAnswerAnnotationToApiPurposeTemplateAnswerAnnotation } from "../../src/model/domain/apiConverter.js";
import {
  purposeTemplateNotFound,
  purposeTemplateNotInExpectedStates,
  purposeTemplateRiskAnalysisFormNotFound,
  purposeTemplateStateConflict,
  riskAnalysisTemplateAnswerNotFound,
  riskAnalysisTemplateValidationFailed,
  tenantNotAllowed,
  hyperlinkDetectionError,
} from "../../src/model/domain/errors.js";

const {
  HTTP_STATUS_OK,
  HTTP_STATUS_FORBIDDEN,
  HTTP_STATUS_NOT_FOUND,
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
  HTTP_STATUS_CONFLICT,
} = constants;

describe("API PUT /purposeTemplates/:purposeTemplateId/riskAnalysis/answers/:answerId/annotation", () => {
  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];

  const purposeTemplateId = generateId<PurposeTemplateId>();
  const answerId = generateId();
  const mockRiskAnalysisAnswerAnnotation: RiskAnalysisTemplateAnswerAnnotation =
    {
      id: generateId(),
      text: "This is a test annotation",
      docs: [],
    };

  const validRiskAnalysisAnswerAnnotationRequest: purposeTemplateApi.RiskAnalysisTemplateAnswerAnnotationSeed =
    {
      text: "This is a test annotation",
    };

  const riskAnalysisAnswerAnnotationResponse = getMockWithMetadata(
    mockRiskAnalysisAnswerAnnotation,
    0
  );

  beforeEach(() => {
    purposeTemplateService.addRiskAnalysisAnswerAnnotation = vi
      .fn()
      .mockResolvedValue(riskAnalysisAnswerAnnotationResponse);
  });

  const makeRequest = async (
    token: string,
    riskAnalysisAnswerAnnotationRequest: purposeTemplateApi.RiskAnalysisTemplateAnswerAnnotationSeed
  ) =>
    request(api)
      .put(
        `/purposeTemplates/${purposeTemplateId}/riskAnalysis/answers/${answerId}/annotation`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(riskAnalysisAnswerAnnotationRequest);

  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(
        token,
        validRiskAnalysisAnswerAnnotationRequest
      );
      expect(res.status).toBe(HTTP_STATUS_OK);
      expect(res.body).toEqual(
        purposeTemplateAnswerAnnotationToApiPurposeTemplateAnswerAnnotation(
          mockRiskAnalysisAnswerAnnotation
        )
      );
      expect(res.headers["x-metadata-version"]).toBe(
        riskAnalysisAnswerAnnotationResponse.metadata.version.toString()
      );
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(
      token,
      validRiskAnalysisAnswerAnnotationRequest
    );
    expect(res.status).toBe(HTTP_STATUS_FORBIDDEN);
  });

  it.each([
    {},
    {
      ...validRiskAnalysisAnswerAnnotationRequest,
      text: undefined,
    },
    {
      ...validRiskAnalysisAnswerAnnotationRequest,
      text: "",
    },
  ])("Should return 400 if passed invalid data: %s", async (body) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(
      token,
      body as purposeTemplateApi.RiskAnalysisTemplateAnswerAnnotationSeed
    );
    expect(res.status).toBe(HTTP_STATUS_BAD_REQUEST);
  });

  it("Should return 400 if annotation text is longer than 2000 characters", async () => {
    const OVER_2000_CHAR = "O".repeat(2001);
    const requestWithLongAnnotation: purposeTemplateApi.RiskAnalysisTemplateAnswerAnnotationSeed =
      {
        text: OVER_2000_CHAR,
      };

    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, requestWithLongAnnotation);
    expect(res.status).toBe(HTTP_STATUS_BAD_REQUEST);
  });

  it.each([
    {
      error: riskAnalysisTemplateValidationFailed([]),
      expectedStatus: HTTP_STATUS_BAD_REQUEST,
    },
    {
      error: hyperlinkDetectionError(
        "This text contains a hyperlink: https://example.com"
      ),
      expectedStatus: HTTP_STATUS_BAD_REQUEST,
    },
    {
      error: purposeTemplateNotFound(purposeTemplateId),
      expectedStatus: HTTP_STATUS_NOT_FOUND,
    },
    {
      error: riskAnalysisTemplateAnswerNotFound({
        purposeTemplateId,
        answerId: generateId(),
      }),
      expectedStatus: HTTP_STATUS_NOT_FOUND,
    },
    {
      error: purposeTemplateNotInExpectedStates(
        purposeTemplateId,
        purposeTemplateState.archived,
        [purposeTemplateState.published]
      ),
      expectedStatus: HTTP_STATUS_CONFLICT,
    },
    {
      error: purposeTemplateStateConflict(
        purposeTemplateId,
        purposeTemplateState.archived
      ),
      expectedStatus: HTTP_STATUS_CONFLICT,
    },
    {
      error: tenantNotAllowed(generateId()),
      expectedStatus: HTTP_STATUS_FORBIDDEN,
    },
    {
      error: purposeTemplateRiskAnalysisFormNotFound(purposeTemplateId),
      expectedStatus: HTTP_STATUS_INTERNAL_SERVER_ERROR,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      const token = generateToken(authRole.ADMIN_ROLE);

      purposeTemplateService.addRiskAnalysisAnswerAnnotation = vi
        .fn()
        .mockRejectedValue(error);

      const res = await makeRequest(
        token,
        validRiskAnalysisAnswerAnnotationRequest
      );

      expect(res.status).toBe(expectedStatus);
    }
  );
});
