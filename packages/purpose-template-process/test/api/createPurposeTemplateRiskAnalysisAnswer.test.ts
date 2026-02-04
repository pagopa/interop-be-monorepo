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
  RiskAnalysisTemplateSingleAnswer,
} from "pagopa-interop-models";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { purposeTemplateApi } from "pagopa-interop-api-clients";
import { api, purposeTemplateService } from "../vitest.api.setup.js";
import { riskAnalysisAnswerToApiRiskAnalysisAnswer } from "../../src/model/domain/apiConverter.js";
import {
  hyperlinkDetectionError,
  purposeTemplateNotFound,
  purposeTemplateNotInExpectedStates,
  purposeTemplateRiskAnalysisFormNotFound,
  purposeTemplateStateConflict,
  riskAnalysisTemplateValidationFailed,
  tenantNotAllowed,
} from "../../src/model/domain/errors.js";

const {
  HTTP_STATUS_OK,
  HTTP_STATUS_FORBIDDEN,
  HTTP_STATUS_NOT_FOUND,
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
  HTTP_STATUS_CONFLICT,
} = constants;

describe("API POST /purposeTemplates/:id/riskAnalysis/answers", () => {
  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];

  const purposeTemplateId = generateId<PurposeTemplateId>();
  const mockRiskAnalysisAnswer: RiskAnalysisTemplateSingleAnswer = {
    id: generateId(),
    key: "test-key",
    value: "test-value",
    editable: true,
    suggestedValues: ["suggestion1", "suggestion2"],
  };

  const validRiskAnalysisAnswerRequest: purposeTemplateApi.RiskAnalysisTemplateAnswerRequest =
    {
      answerKey: "test-key",
      answerData: {
        values: ["test-value"],
        editable: true,
        suggestedValues: ["suggestion1", "suggestion2"],
      },
    };

  const riskAnalysisAnswerResponse = getMockWithMetadata(
    mockRiskAnalysisAnswer,
    0
  );

  beforeEach(() => {
    purposeTemplateService.createRiskAnalysisAnswer = vi
      .fn()
      .mockResolvedValue(riskAnalysisAnswerResponse);
  });

  const makeRequest = async (
    token: string,
    riskAnalysisAnswerRequest: purposeTemplateApi.RiskAnalysisTemplateAnswerRequest
  ) =>
    request(api)
      .post(`/purposeTemplates/${purposeTemplateId}/riskAnalysis/answers`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(riskAnalysisAnswerRequest);

  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, validRiskAnalysisAnswerRequest);
      expect(res.status).toBe(HTTP_STATUS_OK);
      expect(res.body).toEqual(
        riskAnalysisAnswerToApiRiskAnalysisAnswer(mockRiskAnalysisAnswer)
      );
      expect(res.headers["x-metadata-version"]).toBe(
        riskAnalysisAnswerResponse.metadata.version.toString()
      );
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, validRiskAnalysisAnswerRequest);
    expect(res.status).toBe(HTTP_STATUS_FORBIDDEN);
  });

  it.each([
    {},
    {
      ...validRiskAnalysisAnswerRequest,
      answerKey: undefined,
    },
    {
      ...validRiskAnalysisAnswerRequest,
      answerData: undefined,
    },
    {
      ...validRiskAnalysisAnswerRequest,
      answerData: {},
    },
    {
      ...validRiskAnalysisAnswerRequest,
      answerData: {
        ...validRiskAnalysisAnswerRequest.answerData,
        values: undefined,
      },
    },
    {
      ...validRiskAnalysisAnswerRequest,
      answerData: {
        ...validRiskAnalysisAnswerRequest.answerData,
        editable: undefined,
      },
    },
    {
      ...validRiskAnalysisAnswerRequest,
      answerData: {
        ...validRiskAnalysisAnswerRequest.answerData,
        suggestedValues: undefined,
      },
    },
  ])("Should return 400 if passed invalid data: %s", async (body) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(
      token,
      body as purposeTemplateApi.RiskAnalysisTemplateAnswerRequest
    );
    expect(res.status).toBe(HTTP_STATUS_BAD_REQUEST);
  });

  it("Should return 400 if annotation text contains more than 2000 characters", async () => {
    const textWithMoreThan2000 = "T".repeat(2001);
    const requestWithMoreThan2000: purposeTemplateApi.RiskAnalysisTemplateAnswerRequest =
      {
        ...validRiskAnalysisAnswerRequest,
        answerData: {
          ...validRiskAnalysisAnswerRequest.answerData,
          annotation: {
            text: textWithMoreThan2000,
          },
        },
      };

    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, requestWithMoreThan2000);
    expect(res.status).toBe(HTTP_STATUS_BAD_REQUEST);
  });

  it("Should return 400 if annotation text contains hyperlinks", async () => {
    const textWithHyperlink =
      "This text contains a hyperlink: https://example.com";
    const requestWithHyperlink: purposeTemplateApi.RiskAnalysisTemplateAnswerRequest =
      {
        ...validRiskAnalysisAnswerRequest,
        answerData: {
          ...validRiskAnalysisAnswerRequest.answerData,
          annotation: {
            text: textWithHyperlink,
          },
        },
      };

    purposeTemplateService.createRiskAnalysisAnswer = vi
      .fn()
      .mockRejectedValue(hyperlinkDetectionError(textWithHyperlink));

    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, requestWithHyperlink);
    expect(res.status).toBe(HTTP_STATUS_BAD_REQUEST);
  });

  it.each([
    {
      error: purposeTemplateNotFound(purposeTemplateId),
      expectedStatus: HTTP_STATUS_NOT_FOUND,
    },
    {
      error: purposeTemplateRiskAnalysisFormNotFound(purposeTemplateId),
      expectedStatus: HTTP_STATUS_INTERNAL_SERVER_ERROR,
    },
    {
      error: purposeTemplateStateConflict(
        purposeTemplateId,
        purposeTemplateState.archived
      ),
      expectedStatus: HTTP_STATUS_CONFLICT,
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
      error: tenantNotAllowed(generateId()),
      expectedStatus: HTTP_STATUS_NOT_FOUND,
    },
    {
      error: hyperlinkDetectionError("Invalid hyperlink in answer"),
      expectedStatus: HTTP_STATUS_BAD_REQUEST,
    },
    {
      error: riskAnalysisTemplateValidationFailed([]),
      expectedStatus: HTTP_STATUS_BAD_REQUEST,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      const token = generateToken(authRole.ADMIN_ROLE);

      purposeTemplateService.createRiskAnalysisAnswer = vi
        .fn()
        .mockRejectedValue(error);

      const res = await makeRequest(token, validRiskAnalysisAnswerRequest);

      expect(res.status).toBe(expectedStatus);
    }
  );
});
