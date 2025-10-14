/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { AuthRole, authRole } from "pagopa-interop-commons";
import {
  generateToken,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  generateId,
  RiskAnalysisTemplateAnswerAnnotation,
} from "pagopa-interop-models";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { purposeTemplateApi } from "pagopa-interop-api-clients";
import { api, purposeTemplateService } from "../vitest.api.setup.js";
import { purposeTemplateAnswerAnnotationToApiPurposeTemplateAnswerAnnotation } from "../../src/model/domain/apiConverter.js";

describe("API PUT /purposeTemplates/:purposeTemplateId/riskAnalysis/answers/:answerId/annotation", () => {
  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];

  const purposeTemplateId = generateId();
  const answerId = generateId();
  const mockRiskAnalysisAnswerAnnotation: RiskAnalysisTemplateAnswerAnnotation =
    {
      id: generateId(),
      text: "This is a test annotation",
      docs: [],
    };

  const validRiskAnalysisAnswerAnnotationRequest: purposeTemplateApi.RiskAnalysisTemplateAnswerAnnotationText =
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
    riskAnalysisAnswerAnnotationRequest: purposeTemplateApi.RiskAnalysisTemplateAnswerAnnotationText
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
      expect(res.status).toBe(200);
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
    expect(res.status).toBe(403);
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
      body as purposeTemplateApi.RiskAnalysisTemplateAnswerAnnotationText
    );
    expect(res.status).toBe(400);
  });

  it("Should return 400 if annotation text is longer than 250 characters", async () => {
    const OVER_250_CHAR = "Over".repeat(251);
    const requestWithLongAnnotation: purposeTemplateApi.RiskAnalysisTemplateAnswerAnnotationText =
      {
        text: OVER_250_CHAR,
      };

    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, requestWithLongAnnotation);
    expect(res.status).toBe(400);
  });

  // todo disabled until hyperlinks validation rules are defined
  /* it("Should return 400 if annotation text contains hyperlinks", async () => {
    const textWithHyperlink =
      "This text contains a hyperlink: https://example.com";
    const requestWithHyperlink: purposeTemplateApi.RiskAnalysisTemplateAnswerAnnotationText =
      {
        text: textWithHyperlink,
      };

    purposeTemplateService.addRiskAnalysisAnswerAnnotation = vi
      .fn()
      .mockRejectedValue(hyperlinkDetectionError(textWithHyperlink));

    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, requestWithHyperlink);
    expect(res.status).toBe(400);
  }); */
});
