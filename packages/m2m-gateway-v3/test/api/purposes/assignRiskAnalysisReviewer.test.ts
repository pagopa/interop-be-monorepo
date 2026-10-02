import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { AuthRole, authRole } from "pagopa-interop-commons";
import {
  generateToken,
  getMockDPoPProof,
  getMockedApiPurpose,
} from "pagopa-interop-commons-test";
import { generateId, pollingMaxRetriesExceeded } from "pagopa-interop-models";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { toM2MGatewayApiPurpose } from "../../../src/api/purposeApiConverter.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { config } from "../../../src/config/config.js";
import { missingMetadata } from "../../../src/model/errors.js";
import { api, mockPurposeService } from "../../vitest.api.setup.js";

describe("POST /purposes/:purposeId/riskAnalysis/assign router test", () => {
  const mockApiPurpose = getMockedApiPurpose();
  const mockM2MPurposeResponse = toM2MGatewayApiPurpose(mockApiPurpose);
  const seed: m2mGatewayApiV3.RiskAnalysisAssignmentSeed = {
    reviewMode:
      m2mGatewayApiV3.RiskAnalysisReviewMode.Enum
        .REVIEWER_WRITES_REVIEWER_SIGNS,
    reviewerIds: [generateId()],
  };

  const makeRequest = async (
    token: string,
    purposeId: string,
    body: object = seed
  ) =>
    request(api)
      .post(`${appBasePath}/purposes/${purposeId}/riskAnalysis/assign`)
      .set("Authorization", `DPoP ${token}`)
      .set("DPoP", (await getMockDPoPProof()).dpopProofJWS)
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];

  it.each([
    m2mGatewayApiV3.RiskAnalysisReviewMode.Enum.ADMIN_WRITES_ADMIN_SIGNS,
    m2mGatewayApiV3.RiskAnalysisReviewMode.Enum.ADMIN_WRITES_REVIEWER_SIGNS,
    m2mGatewayApiV3.RiskAnalysisReviewMode.Enum.REVIEWER_WRITES_REVIEWER_SIGNS,
  ])("Should return 200 for review mode %s", async (reviewMode) => {
    mockPurposeService.assignRiskAnalysisReviewer = vi
      .fn()
      .mockResolvedValue(mockM2MPurposeResponse);

    const body = {
      reviewMode,
      ...(reviewMode ===
      m2mGatewayApiV3.RiskAnalysisReviewMode.Enum.ADMIN_WRITES_ADMIN_SIGNS
        ? {}
        : { reviewerIds: [generateId()] }),
    };
    const res = await makeRequest(
      generateToken(authRole.M2M_ADMIN_ROLE),
      mockApiPurpose.id,
      body
    );

    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockM2MPurposeResponse);
  });

  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      mockPurposeService.assignRiskAnalysisReviewer = vi
        .fn()
        .mockResolvedValue(mockM2MPurposeResponse);

      const res = await makeRequest(generateToken(role), mockApiPurpose.id);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MPurposeResponse);
    }
  );

  it.each([
    {},
    { reviewMode: "INVALID_MODE" },
    {
      reviewMode:
        m2mGatewayApiV3.RiskAnalysisReviewMode.Enum
          .REVIEWER_WRITES_REVIEWER_SIGNS,
      reviewerIds: ["INVALID_ID"],
    },
    {
      reviewMode:
        m2mGatewayApiV3.RiskAnalysisReviewMode.Enum
          .REVIEWER_WRITES_REVIEWER_SIGNS,
      reviewerIds: [],
    },
    {
      reviewMode:
        m2mGatewayApiV3.RiskAnalysisReviewMode.Enum
          .REVIEWER_WRITES_REVIEWER_SIGNS,
      unsupportedField: "unsupportedValue",
    },
  ])("Should return 400 for invalid assignment seed", async (body) => {
    const res = await makeRequest(
      generateToken(authRole.M2M_ADMIN_ROLE),
      mockApiPurpose.id,
      body
    );

    expect(res.status).toBe(400);
  });

  it("Should accept mode 1 without reviewer ids", async () => {
    mockPurposeService.assignRiskAnalysisReviewer = vi
      .fn()
      .mockResolvedValue(mockM2MPurposeResponse);

    const res = await makeRequest(
      generateToken(authRole.M2M_ADMIN_ROLE),
      mockApiPurpose.id,
      {
        reviewMode:
          m2mGatewayApiV3.RiskAnalysisReviewMode.Enum.ADMIN_WRITES_ADMIN_SIGNS,
      }
    );

    expect(res.status).toBe(200);
  });

  it("Should return 400 for invalid purpose id", async () => {
    const res = await makeRequest(
      generateToken(authRole.M2M_ADMIN_ROLE),
      "INVALID_ID"
    );

    expect(res.status).toBe(400);
  });

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const res = await makeRequest(generateToken(role), mockApiPurpose.id);

    expect(res.status).toBe(403);
  });

  it.each([
    missingMetadata(),
    pollingMaxRetriesExceeded(
      config.defaultPollingMaxRetries,
      config.defaultPollingRetryDelay
    ),
  ])("Should return 500 in case of $code error", async (error) => {
    mockPurposeService.assignRiskAnalysisReviewer = vi
      .fn()
      .mockRejectedValue(error);

    const res = await makeRequest(
      generateToken(authRole.M2M_ADMIN_ROLE),
      mockApiPurpose.id
    );

    expect(res.status).toBe(500);
  });

  it.each([
    { ...mockM2MPurposeResponse, createdAt: undefined },
    { ...mockM2MPurposeResponse, eserviceId: "invalidId" },
    { ...mockM2MPurposeResponse, extraParam: "extraValue" },
    {},
  ])(
    "Should return 500 when API model parsing fails for response",
    async (response) => {
      mockPurposeService.assignRiskAnalysisReviewer = vi
        .fn()
        .mockResolvedValue(response);

      const res = await makeRequest(
        generateToken(authRole.M2M_ADMIN_ROLE),
        mockApiPurpose.id
      );

      expect(res.status).toBe(500);
    }
  );
});
