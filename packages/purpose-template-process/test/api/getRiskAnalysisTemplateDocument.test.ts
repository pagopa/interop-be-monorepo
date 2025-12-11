/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { constants } from "http2";
import { AuthRole, authRole } from "pagopa-interop-commons";
import {
  generateToken,
  getMockPurposeTemplate,
} from "pagopa-interop-commons-test";
import {
  PurposeTemplate,
  PurposeTemplateId,
  RiskAnalysisFormTemplateId,
  RiskAnalysisTemplateDocumentId,
  RiskAnalysisTemplateDocument,
  generateId,
} from "pagopa-interop-models";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { purposeTemplateApi } from "pagopa-interop-api-clients";
import { api, purposeTemplateService } from "../vitest.api.setup.js";
import { riskAnalysisTemplateDocumentToApiRiskAnalysisTemplateDocument } from "../../src/model/domain/apiConverter.js";
import {
  purposeTemplateNotFound,
  purposeTemplateRiskAnalysisFormNotFound,
  purposeTemplateRiskAnalysisTemplateDocumentNotFound,
} from "../../src/model/domain/errors.js";

const {
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_FORBIDDEN,
  HTTP_STATUS_OK,
  HTTP_STATUS_NOT_FOUND,
} = constants;

describe("API GET /purposeTemplates/:purposeTemplateId/riskAnalysisDocument test", () => {
  const mockPurposeTemplate: PurposeTemplate = getMockPurposeTemplate();

  const mockRiskAnalysisDocument: RiskAnalysisTemplateDocument = {
    id: generateId<RiskAnalysisTemplateDocumentId>(),
    path: "s3://path/to/the/risk/analysis/file.pdf",
    contentType: "application/pdf",
    name: "risk_analysis_file.pdf",
    prettyName: "Risk analysis document",
    createdAt: new Date(),
  };

  beforeEach(() => {
    purposeTemplateService.getRiskAnalysisTemplateDocument = vi
      .fn()
      .mockResolvedValue(mockRiskAnalysisDocument);
  });

  const makeRequest = async (
    token: string,
    purposeTemplateId: PurposeTemplateId = mockPurposeTemplate.id
  ) =>
    request(api)
      .get(`/purposeTemplates/${purposeTemplateId}/riskAnalysisDocument`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.SUPPORT_ROLE,
  ];

  it.each(authorizedRoles)(
    "Should return 200 for user with role %s on successful risk analysis template document retrieved",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);

      expect(res.status).toBe(HTTP_STATUS_OK);
      expect(res.body).toEqual(
        purposeTemplateApi.RiskAnalysisTemplateDocument.parse(
          riskAnalysisTemplateDocumentToApiRiskAnalysisTemplateDocument(
            mockRiskAnalysisDocument
          )
        )
      );
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(HTTP_STATUS_FORBIDDEN);
  });

  it.each([
    {
      error: purposeTemplateNotFound(mockPurposeTemplate.id),
      expectedStatus: HTTP_STATUS_NOT_FOUND,
    },
    {
      error: purposeTemplateRiskAnalysisFormNotFound(
        mockPurposeTemplate.id,
        generateId<RiskAnalysisFormTemplateId>()
      ),
      expectedStatus: HTTP_STATUS_NOT_FOUND,
    },
    {
      error: purposeTemplateRiskAnalysisTemplateDocumentNotFound(
        generateId<RiskAnalysisFormTemplateId>()
      ),
      expectedStatus: HTTP_STATUS_NOT_FOUND,
    },
  ])(
    "Should return $expectedStatus for $error.code error",
    async ({ error, expectedStatus }) => {
      purposeTemplateService.getRiskAnalysisTemplateDocument = vi
        .fn()
        .mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it("Should return 400 if passed an invalid purpose template id", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(
      token,
      "invalid-purpose-id" as PurposeTemplateId
    );
    expect(res.status).toBe(HTTP_STATUS_BAD_REQUEST);
  });
});
