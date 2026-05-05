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
  RiskAnalysisTemplateSignedDocument,
  generateId,
} from "pagopa-interop-models";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  purposeTemplateNotFound,
  purposeTemplateRiskAnalysisFormNotFound,
} from "../../src/model/domain/errors.js";
import { api, purposeTemplateService } from "../vitest.api.setup.js";

const {
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_FORBIDDEN,
  HTTP_STATUS_NO_CONTENT,
  HTTP_STATUS_NOT_FOUND,
} = constants;

describe("API POST /internal/purposeTemplates/:purposeTemplateId/riskAnalysisDocument/signed test", () => {
  const mockPurposeTemplate: PurposeTemplate = getMockPurposeTemplate();

  const mockRiskAnalysisDocumentPayload: RiskAnalysisTemplateSignedDocument = {
    id: generateId<RiskAnalysisTemplateDocumentId>(),
    path: "s3://path/to/the/risk/analysis/file.pdf",
    contentType: "application/pdf",
    name: "risk_analysis_file.pdf",
    prettyName: "Risk analysis document",
    createdAt: new Date(),
    signedAt: new Date(),
  };

  beforeEach(() => {
    purposeTemplateService.internalAddRiskAnalysisTemplateSignedDocumentMetadata =
      vi.fn().mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    purposeTemplateId: PurposeTemplateId = mockPurposeTemplate.id,
    payload: RiskAnalysisTemplateSignedDocument = mockRiskAnalysisDocumentPayload
  ) =>
    request(api)
      .post(
        `/internal/purposeTemplates/${purposeTemplateId}/riskAnalysisDocument/signed`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(payload);

  const authorizedRoles: AuthRole[] = [authRole.INTERNAL_ROLE];

  it.each(authorizedRoles)(
    "Should return 204 for user with role %s on successful risk analysis template signed document add",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);

      expect(
        purposeTemplateService.internalAddRiskAnalysisTemplateSignedDocumentMetadata
      ).toHaveBeenCalledWith(
        mockPurposeTemplate.id,
        mockRiskAnalysisDocumentPayload,
        expect.anything()
      );
      expect(res.status).toBe(HTTP_STATUS_NO_CONTENT);
      expect(res.body).toEqual({});
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
      description: "purposeTemplateNotFound",
    },
    {
      error: purposeTemplateRiskAnalysisFormNotFound(
        mockPurposeTemplate.id,
        generateId<RiskAnalysisFormTemplateId>()
      ),
      expectedStatus: HTTP_STATUS_NOT_FOUND,
      description: "purposeTemplateRiskAnalysisFormNotFound",
    },
  ])(
    "Should return $expectedStatus for $description error",
    async ({ error, expectedStatus }) => {
      purposeTemplateService.internalAddRiskAnalysisTemplateSignedDocumentMetadata =
        vi.fn().mockRejectedValue(error);
      const token = generateToken(authRole.INTERNAL_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );
  it("Should return 400 if passed an invalid purpose template id", async () => {
    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(
      token,
      "invalid-purpose-id" as PurposeTemplateId
    );
    expect(res.status).toBe(HTTP_STATUS_BAD_REQUEST);
  });

  it("Should return 400 if passed an invalid risk analysis document payload", async () => {
    const token = generateToken(authRole.INTERNAL_ROLE);
    const invalidPayload = {
      id: generateId(),
      submissionDate: new Date(),
    } as unknown as RiskAnalysisTemplateSignedDocument;

    const res = await makeRequest(
      token,
      mockPurposeTemplate.id,
      invalidPayload
    );
    expect(res.status).toBe(HTTP_STATUS_BAD_REQUEST);
  });
});
